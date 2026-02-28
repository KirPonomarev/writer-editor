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
import {
  registerProjectCommands,
  LEGACY_ACTION_TO_COMMAND,
} from '../../src/renderer/commands/projectCommands.mjs';

const TOKEN_NAME = 'X18_WS02_QUICK_OPEN_AND_COMMAND_PALETTE_POLISH_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_QUICK_OPEN_DOC_PATH = 'docs/OPS/STATUS/X18_QUICK_OPEN_PALETTE_INDEX_v1.json';
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

function normalizeQuickOpenDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const groupCoverage = Array.isArray(source.groupCoverage) ? source.groupCoverage : [];

  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    quickOpenVersion: normalizeString(source.quickOpenVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { sort: false }),
    requiredGroups: toUniqueStrings(source.requiredGroups, { sort: false }),
    requiredQuickOpenCommands: toUniqueStrings(source.requiredQuickOpenCommands),
    groupCoverage: groupCoverage
      .map((row) => ({
        groupId: normalizeString(row?.groupId),
        coverageType: normalizeString(row?.coverageType).toLowerCase(),
      }))
      .filter((row) => row.groupId),
    entries: entries
      .map((row) => ({
        groupId: normalizeString(row?.groupId),
        quickOpenKey: normalizeString(row?.quickOpenKey),
        actionId: normalizeString(row?.actionId),
        commandId: normalizeString(row?.commandId),
        hotkey: normalizeString(row?.hotkey),
        menuHint: normalizeString(row?.menuHint),
        shortcutHint: normalizeString(row?.shortcutHint),
        paletteDiscoverable: row?.paletteDiscoverable === true,
        modes: toUniqueStrings(row?.modes, { sort: false }),
        profiles: toUniqueStrings(row?.profiles, { sort: false }),
      }))
      .filter((row) => row.groupId && row.quickOpenKey && row.actionId && row.commandId),
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

function validateQuickOpenDoc({ quickOpenDoc, menuProjection, runtimeMeta, capabilityBinding, legacyActionMap }) {
  const duplicatePaletteEntries = [];
  const commandBindingMissing = [];
  const capabilityBindingMissing = [];
  const actionBindingMismatch = [];
  const menuHintMismatch = [];
  const shortcutHintMismatch = [];
  const staleEntryTargets = [];
  const modeProfileVisibilityGaps = [];
  const paletteDiscoverabilityGaps = [];
  const unknownModes = [];
  const unknownProfiles = [];
  const requiredGroupMissing = [];
  const requiredQuickOpenCommandMissing = [];

  const coverageGroups = new Set(quickOpenDoc.groupCoverage.map((row) => row.groupId));
  for (const groupId of quickOpenDoc.requiredGroups) {
    if (!coverageGroups.has(groupId)) requiredGroupMissing.push({ groupId, reason: 'GROUP_COVERAGE_MISSING' });
  }

  const commandSet = new Set(quickOpenDoc.entries.map((row) => row.commandId));
  for (const commandId of quickOpenDoc.requiredQuickOpenCommands) {
    if (!commandSet.has(commandId)) {
      requiredQuickOpenCommandMissing.push({ commandId, reason: 'QUICK_OPEN_INDEX_GAP' });
    }
  }

  const quickOpenKeyIndex = new Map();
  const docModes = new Set(quickOpenDoc.modes);
  const docProfiles = new Set(quickOpenDoc.profiles);
  const projection = [];

  for (const entry of quickOpenDoc.entries) {
    if (!quickOpenKeyIndex.has(entry.quickOpenKey)) quickOpenKeyIndex.set(entry.quickOpenKey, new Set());
    quickOpenKeyIndex.get(entry.quickOpenKey).add(entry.commandId);

    const commandMeta = runtimeMeta.get(entry.commandId) || null;
    if (!commandMeta) {
      commandBindingMissing.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, reason: 'COMMAND_NOT_REGISTERED' });
    }

    const expectedCommand = normalizeString(legacyActionMap[entry.actionId]);
    if (!expectedCommand || expectedCommand !== entry.commandId) {
      actionBindingMismatch.push({
        quickOpenKey: entry.quickOpenKey,
        actionId: entry.actionId,
        commandId: entry.commandId,
        expectedCommandId: expectedCommand || '',
        reason: 'LEGACY_ACTION_BINDING_MISMATCH',
      });
    }

    if (!capabilityBinding.has(entry.commandId)) {
      capabilityBindingMissing.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, reason: 'CAPABILITY_BINDING_MISSING' });
    }

    const runtimeHotkey = normalizeString(commandMeta?.hotkey);
    if (!runtimeHotkey || runtimeHotkey !== entry.hotkey) {
      menuHintMismatch.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, hotkey: entry.hotkey, runtimeHotkey, menuHint: entry.menuHint, reason: 'HOTKEY_MISMATCH_WITH_RUNTIME' });
    } else if (entry.menuHint !== entry.hotkey) {
      menuHintMismatch.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, hotkey: entry.hotkey, runtimeHotkey, menuHint: entry.menuHint, reason: 'MENU_HINT_MISMATCH' });
    }

    if (entry.shortcutHint !== entry.hotkey) {
      shortcutHintMismatch.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, hotkey: entry.hotkey, shortcutHint: entry.shortcutHint, reason: 'SHORTCUT_HINT_MISMATCH' });
    }

    for (const mode of entry.modes) {
      if (!docModes.has(mode)) {
        unknownModes.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, mode });
      }
      for (const profile of entry.profiles) {
        if (!docProfiles.has(profile)) {
          unknownProfiles.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, profile });
        }

        const channels = menuProjection.get(`${entry.commandId}|${mode}|${profile}`) || null;
        if (!channels) {
          staleEntryTargets.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, mode, profile, reason: 'STALE_ENTRY_TARGET' });
          modeProfileVisibilityGaps.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, mode, profile, reason: 'MENU_VISIBILITY_RULE_MISSING' });
          continue;
        }

        const anyVisible = channels.menu === 'visible' || channels.toolbar === 'visible' || channels.palette === 'visible';
        if (!anyVisible) {
          modeProfileVisibilityGaps.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, mode, profile, reason: 'ALL_CHANNELS_HIDDEN' });
        }

        if (entry.paletteDiscoverable) {
          const runtimePalette = Array.isArray(commandMeta?.surface) && commandMeta.surface.includes('palette');
          if (!runtimePalette || channels.palette !== 'visible') {
            paletteDiscoverabilityGaps.push({ quickOpenKey: entry.quickOpenKey, commandId: entry.commandId, mode, profile, runtimePalette, menuPaletteState: channels.palette, reason: 'PALETTE_DISCOVERABILITY_GAP' });
          }
        }

        projection.push({
          quickOpenKey: entry.quickOpenKey,
          actionId: entry.actionId,
          groupId: entry.groupId,
          commandId: entry.commandId,
          mode,
          profile,
          hotkey: entry.hotkey,
          menuHint: entry.menuHint,
          shortcutHint: entry.shortcutHint,
          channels,
        });
      }
    }
  }

  for (const [quickOpenKey, commandIds] of quickOpenKeyIndex.entries()) {
    if (commandIds.size > 1) {
      duplicatePaletteEntries.push({ quickOpenKey, commandIds: [...commandIds].sort((a, b) => a.localeCompare(b)), reason: 'DUPLICATE_PALETTE_ENTRY' });
    }
  }

  const cleaned = {
    duplicatePaletteEntries: uniqueIssueRows(duplicatePaletteEntries, (row) => row.quickOpenKey),
    commandBindingMissing: uniqueIssueRows(commandBindingMissing, (row) => `${row.quickOpenKey}|${row.commandId}`),
    capabilityBindingMissing: uniqueIssueRows(capabilityBindingMissing, (row) => `${row.quickOpenKey}|${row.commandId}`),
    actionBindingMismatch: uniqueIssueRows(actionBindingMismatch, (row) => `${row.quickOpenKey}|${row.commandId}|${row.expectedCommandId}`),
    menuHintMismatch: uniqueIssueRows(menuHintMismatch, (row) => `${row.quickOpenKey}|${row.commandId}|${row.reason}`),
    shortcutHintMismatch: uniqueIssueRows(shortcutHintMismatch, (row) => `${row.quickOpenKey}|${row.commandId}|${row.reason}`),
    staleEntryTargets: uniqueIssueRows(staleEntryTargets, (row) => `${row.quickOpenKey}|${row.commandId}|${row.mode}|${row.profile}`),
    modeProfileVisibilityGaps: uniqueIssueRows(modeProfileVisibilityGaps, (row) => `${row.quickOpenKey}|${row.commandId}|${row.mode}|${row.profile}|${row.reason}`),
    paletteDiscoverabilityGaps: uniqueIssueRows(paletteDiscoverabilityGaps, (row) => `${row.quickOpenKey}|${row.commandId}|${row.mode}|${row.profile}`),
    unknownModes: uniqueIssueRows(unknownModes, (row) => `${row.quickOpenKey}|${row.commandId}|${row.mode}`),
    unknownProfiles: uniqueIssueRows(unknownProfiles, (row) => `${row.quickOpenKey}|${row.commandId}|${row.profile}`),
    requiredGroupMissing: uniqueIssueRows(requiredGroupMissing, (row) => row.groupId),
    requiredQuickOpenCommandMissing: uniqueIssueRows(requiredQuickOpenCommandMissing, (row) => row.commandId),
  };

  const projectionSorted = projection.sort((a, b) => {
    const left = `${a.quickOpenKey}|${a.commandId}|${a.mode}|${a.profile}`;
    const right = `${b.quickOpenKey}|${b.commandId}|${b.mode}|${b.profile}`;
    return left.localeCompare(right);
  });
  const projectionHash = createHash('sha256').update(stableStringify(projectionSorted)).digest('hex');

  const ok = !quickOpenDoc.blockingSurfaceExpansion
    && quickOpenDoc.nonBlockingClassification === 'advisory_until_machine_bound'
    && cleaned.duplicatePaletteEntries.length === 0
    && cleaned.commandBindingMissing.length === 0
    && cleaned.capabilityBindingMissing.length === 0
    && cleaned.actionBindingMismatch.length === 0
    && cleaned.menuHintMismatch.length === 0
    && cleaned.shortcutHintMismatch.length === 0
    && cleaned.staleEntryTargets.length === 0
    && cleaned.modeProfileVisibilityGaps.length === 0
    && cleaned.paletteDiscoverabilityGaps.length === 0
    && cleaned.unknownModes.length === 0
    && cleaned.unknownProfiles.length === 0
    && cleaned.requiredGroupMissing.length === 0
    && cleaned.requiredQuickOpenCommandMissing.length === 0;

  return {
    ok,
    projection: projectionSorted,
    projectionHash,
    entryCount: quickOpenDoc.entries.length,
    requiredGroupCount: quickOpenDoc.requiredGroups.length,
    requiredQuickOpenCommandCount: quickOpenDoc.requiredQuickOpenCommands.length,
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
        driftCases.push({ failSignalCode, mode: MODE_LABELS[key], expectedDisposition: 'advisory', actualDisposition: normalizeString(verdict.modeDisposition), reason: 'ADVISORY_TO_BLOCKING_DRIFT' });
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

function evaluateX18Ws02QuickOpenAndCommandPalettePolishState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const quickOpenDocPath = path.resolve(repoRoot, DEFAULT_QUICK_OPEN_DOC_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const quickOpenDocRaw = readJsonObject(quickOpenDocPath);
  const menuGroupsRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingRaw = readJsonObject(capabilityBindingPath);

  const quickOpenDoc = normalizeQuickOpenDoc(quickOpenDocRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsRaw);
  const menuProjection = buildMenuProjection(menuGroups);
  const runtimeMeta = buildRuntimeCommandMeta();
  const capabilityBinding = parseCapabilityBindingDoc(capabilityBindingRaw);
  const legacyActionMap = isObjectRecord(LEGACY_ACTION_TO_COMMAND) ? LEGACY_ACTION_TO_COMMAND : {};

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const validateBaseline = () => validateQuickOpenDoc({
    quickOpenDoc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
    legacyActionMap,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(quickOpenDoc);
  if (negative01Doc.entries[1] && negative01Doc.entries[0]) {
    negative01Doc.entries[1].quickOpenKey = negative01Doc.entries[0].quickOpenKey;
    negative01Doc.entries[1].modes = deepClone(negative01Doc.entries[0].modes.slice(0, 1));
    negative01Doc.entries[1].profiles = deepClone(negative01Doc.entries[0].profiles.slice(0, 1));
  }
  const negative01 = validateQuickOpenDoc({
    quickOpenDoc: negative01Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
    legacyActionMap,
  });

  const negative02Doc = deepClone(quickOpenDoc);
  if (negative02Doc.entries[0]) {
    negative02Doc.entries[0].commandId = 'cmd.project.missing.binding';
  }
  const negative02 = validateQuickOpenDoc({
    quickOpenDoc: negative02Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
    legacyActionMap,
  });

  const negative03Doc = deepClone(quickOpenDoc);
  const staleProjection = new Map(menuProjection);
  if (negative03Doc.entries[0]) {
    const staleMode = negative03Doc.entries[0].modes[0] || 'Write';
    const staleProfile = negative03Doc.entries[0].profiles[0] || 'minimal';
    staleProjection.delete(`${negative03Doc.entries[0].commandId}|${staleMode}|${staleProfile}`);
  }
  const negative03 = validateQuickOpenDoc({
    quickOpenDoc: negative03Doc,
    menuProjection: staleProjection,
    runtimeMeta,
    capabilityBinding,
    legacyActionMap,
  });

  const negative04Doc = deepClone(quickOpenDoc);
  if (negative04Doc.entries[0]) {
    negative04Doc.entries[0].modes = ['GhostMode'];
  }
  const negative04 = validateQuickOpenDoc({
    quickOpenDoc: negative04Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
    legacyActionMap,
  });

  const negative05Doc = deepClone(quickOpenDoc);
  if (negative05Doc.entries.length > 0) {
    negative05Doc.entries.pop();
  }
  const negative05 = validateQuickOpenDoc({
    quickOpenDoc: negative05Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
    legacyActionMap,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.duplicatePaletteEntries.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.commandBindingMissing.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.staleEntryTargets.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.unknownModes.length > 0 || negative04.modeProfileVisibilityGaps.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.requiredQuickOpenCommandMissing.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.commandBindingMissing.length === 0
      && baseline.capabilityBindingMissing.length === 0
      && baseline.actionBindingMismatch.length === 0
      && baseline.requiredQuickOpenCommandMissing.length === 0,
    NEXT_TZ_POSITIVE_02: baseline.menuHintMismatch.length === 0
      && baseline.shortcutHintMismatch.length === 0
      && baseline.paletteDiscoverabilityGaps.length === 0
      && baseline.staleEntryTargets.length === 0
      && baseline.modeProfileVisibilityGaps.length === 0,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: quickOpenDoc.blockingSurfaceExpansion === false,
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
    blockingSurfaceExpansion: quickOpenDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      entryCount: baseline.entryCount,
      requiredGroupCount: baseline.requiredGroupCount,
      requiredQuickOpenCommandCount: baseline.requiredQuickOpenCommandCount,
      paletteDuplicateEntryCount: baseline.duplicatePaletteEntries.length,
      commandBindingGapCount: baseline.commandBindingMissing.length,
      capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
      staleEntryTargetCount: baseline.staleEntryTargets.length,
      actionBindingMismatchCount: baseline.actionBindingMismatch.length,
      menuHintMismatchCount: baseline.menuHintMismatch.length,
      shortcutHintMismatchCount: baseline.shortcutHintMismatch.length,
      paletteDiscoverabilityGapCount: baseline.paletteDiscoverabilityGaps.length,
      modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
      quickOpenIndexGapCount: baseline.requiredQuickOpenCommandMissing.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      channelCount: quickOpenDoc.channels.length,
      modeCount: quickOpenDoc.modes.length,
      profileCount: quickOpenDoc.profiles.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    drift,
    detector: {
      detectorId: 'X18_WS02_QUICK_OPEN_PALETTE_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          projectionHash: baseline.projectionHash,
          entryCount: baseline.entryCount,
          requiredGroupCount: baseline.requiredGroupCount,
          requiredQuickOpenCommandCount: baseline.requiredQuickOpenCommandCount,
        },
        counts: {
          paletteDuplicateEntryCount: baseline.duplicatePaletteEntries.length,
          commandBindingGapCount: baseline.commandBindingMissing.length,
          staleEntryTargetCount: baseline.staleEntryTargets.length,
          menuHintMismatchCount: baseline.menuHintMismatch.length,
          shortcutHintMismatchCount: baseline.shortcutHintMismatch.length,
          paletteDiscoverabilityGapCount: baseline.paletteDiscoverabilityGaps.length,
          modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
          quickOpenIndexGapCount: baseline.requiredQuickOpenCommandMissing.length,
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
      quickOpenDocPath: DEFAULT_QUICK_OPEN_DOC_PATH,
      menuGroupsPath: DEFAULT_MENU_GROUPS_PATH,
      capabilityBindingPath: DEFAULT_COMMAND_CAPABILITY_BINDING_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX18Ws02QuickOpenAndCommandPalettePolishState({
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
  console.log(`PALETTE_DUPLICATE_ENTRY_COUNT=${state.counts.paletteDuplicateEntryCount}`);
  console.log(`COMMAND_BINDING_GAP_COUNT=${state.counts.commandBindingGapCount}`);
  console.log(`STALE_ENTRY_TARGET_COUNT=${state.counts.staleEntryTargetCount}`);
  console.log(`QUICK_OPEN_INDEX_GAP_COUNT=${state.counts.quickOpenIndexGapCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX18Ws02QuickOpenAndCommandPalettePolishState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
