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

const TOKEN_NAME = 'X19_WS01_FIRST_RUN_AND_EMPTY_STATE_FLOW_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_ENTRY_FLOW_DOC_PATH = 'docs/OPS/STATUS/X19_ENTRY_FLOW_BASELINE_v1.json';
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

function normalizeEntryFlowDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const hints = Array.isArray(source.emptyStateHints) ? source.emptyStateHints : [];

  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    entryFlowVersion: normalizeString(source.entryFlowVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    channels: toUniqueStrings(source.channels, { sort: false }),
    entrySurfaces: toUniqueStrings(source.entrySurfaces, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { sort: false }),
    requiredEntryActions: toUniqueStrings(source.requiredEntryActions),
    entries: entries
      .map((row) => {
        const channels = isObjectRecord(row?.channels) ? row.channels : {};
        return {
          actionId: normalizeString(row?.actionId),
          commandId: normalizeString(row?.commandId),
          quickStartKey: normalizeString(row?.quickStartKey),
          hintId: normalizeString(row?.hintId),
          hintText: normalizeString(row?.hintText),
          entrySurfaces: toUniqueStrings(row?.entrySurfaces, { sort: false }),
          channels: {
            menu: normalizeString(channels.menu).toLowerCase(),
            toolbar: normalizeString(channels.toolbar).toLowerCase(),
            palette: normalizeString(channels.palette).toLowerCase(),
          },
          modes: toUniqueStrings(row?.modes, { sort: false }),
          profiles: toUniqueStrings(row?.profiles, { sort: false }),
        };
      })
      .filter((row) => row.actionId && row.commandId),
    emptyStateHints: hints
      .map((row) => ({
        hintId: normalizeString(row?.hintId),
        actionId: normalizeString(row?.actionId),
        commandId: normalizeString(row?.commandId),
        entrySurface: normalizeString(row?.entrySurface),
      }))
      .filter((row) => row.hintId && row.actionId && row.commandId),
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

function validateEntryFlowDoc({ entryFlowDoc, menuProjection, runtimeMeta, capabilityBinding }) {
  const commandBindingMissing = [];
  const capabilityBindingMissing = [];
  const staleEntryTargets = [];
  const modeProfileVisibilityGaps = [];
  const channelEntryInconsistency = [];
  const unknownModes = [];
  const unknownProfiles = [];
  const requiredEntryActionMissing = [];
  const staleHintTargets = [];
  const hintCommandMismatch = [];

  const modeSet = new Set(entryFlowDoc.modes);
  const profileSet = new Set(entryFlowDoc.profiles);
  const actionSet = new Set(entryFlowDoc.entries.map((row) => row.actionId));

  for (const actionId of entryFlowDoc.requiredEntryActions) {
    if (!actionSet.has(actionId)) {
      requiredEntryActionMissing.push({ actionId, reason: 'REQUIRED_ENTRY_ACTION_MISSING' });
    }
  }

  const projectionRows = [];

  for (const row of entryFlowDoc.entries) {
    const commandMeta = runtimeMeta.get(row.commandId) || null;
    if (!commandMeta) {
      commandBindingMissing.push({ actionId: row.actionId, commandId: row.commandId, reason: 'COMMAND_NOT_REGISTERED' });
    }
    if (!capabilityBinding.has(row.commandId)) {
      capabilityBindingMissing.push({ actionId: row.actionId, commandId: row.commandId, reason: 'CAPABILITY_BINDING_MISSING' });
    }

    const channelValues = [row.channels.menu, row.channels.toolbar, row.channels.palette];
    if (new Set(channelValues).size !== 1) {
      channelEntryInconsistency.push({
        actionId: row.actionId,
        commandId: row.commandId,
        menu: row.channels.menu,
        toolbar: row.channels.toolbar,
        palette: row.channels.palette,
        reason: 'CHANNEL_ENTRY_INCONSISTENT',
      });
    }

    for (const mode of row.modes) {
      if (!modeSet.has(mode)) {
        unknownModes.push({ actionId: row.actionId, mode });
      }
      for (const profile of row.profiles) {
        if (!profileSet.has(profile)) {
          unknownProfiles.push({ actionId: row.actionId, profile });
        }

        const channels = menuProjection.get(`${row.commandId}|${mode}|${profile}`) || null;
        if (!channels) {
          staleEntryTargets.push({ actionId: row.actionId, commandId: row.commandId, mode, profile, reason: 'STALE_ENTRY_TARGET' });
          modeProfileVisibilityGaps.push({ actionId: row.actionId, commandId: row.commandId, mode, profile, reason: 'MENU_VISIBILITY_RULE_MISSING' });
          continue;
        }

        if (row.channels.menu === 'visible' && channels.menu !== 'visible') {
          modeProfileVisibilityGaps.push({ actionId: row.actionId, commandId: row.commandId, mode, profile, reason: 'MENU_CHANNEL_MISMATCH' });
        }
        if (row.channels.toolbar === 'visible' && channels.toolbar !== 'visible') {
          modeProfileVisibilityGaps.push({ actionId: row.actionId, commandId: row.commandId, mode, profile, reason: 'TOOLBAR_CHANNEL_MISMATCH' });
        }
        if (row.channels.palette === 'visible' && channels.palette !== 'visible') {
          modeProfileVisibilityGaps.push({ actionId: row.actionId, commandId: row.commandId, mode, profile, reason: 'PALETTE_CHANNEL_MISMATCH' });
        }

        projectionRows.push({
          actionId: row.actionId,
          commandId: row.commandId,
          hintId: row.hintId,
          mode,
          profile,
          channels: row.channels,
        });
      }
    }
  }

  const entryByAction = new Map(entryFlowDoc.entries.map((row) => [row.actionId, row]));
  for (const hint of entryFlowDoc.emptyStateHints) {
    const target = entryByAction.get(hint.actionId) || null;
    if (!target) {
      staleHintTargets.push({ hintId: hint.hintId, actionId: hint.actionId, reason: 'HINT_TARGET_ACTION_MISSING' });
      continue;
    }
    if (hint.commandId !== target.commandId) {
      hintCommandMismatch.push({ hintId: hint.hintId, actionId: hint.actionId, expectedCommandId: target.commandId, commandId: hint.commandId, reason: 'HINT_COMMAND_MISMATCH' });
    }
    if (!target.entrySurfaces.includes('empty_state')) {
      staleHintTargets.push({ hintId: hint.hintId, actionId: hint.actionId, reason: 'HINT_TARGET_NOT_EMPTY_STATE' });
    }
  }

  const projection = projectionRows.sort((a, b) => {
    const left = `${a.actionId}|${a.commandId}|${a.mode}|${a.profile}`;
    const right = `${b.actionId}|${b.commandId}|${b.mode}|${b.profile}`;
    return left.localeCompare(right);
  });
  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const cleaned = {
    commandBindingMissing: uniqueIssueRows(commandBindingMissing, (row) => `${row.actionId}|${row.commandId}`),
    capabilityBindingMissing: uniqueIssueRows(capabilityBindingMissing, (row) => `${row.actionId}|${row.commandId}`),
    staleEntryTargets: uniqueIssueRows(staleEntryTargets, (row) => `${row.actionId}|${row.commandId}|${row.mode}|${row.profile}`),
    modeProfileVisibilityGaps: uniqueIssueRows(modeProfileVisibilityGaps, (row) => `${row.actionId}|${row.commandId}|${row.mode}|${row.profile}|${row.reason}`),
    channelEntryInconsistency: uniqueIssueRows(channelEntryInconsistency, (row) => `${row.actionId}|${row.commandId}`),
    unknownModes: uniqueIssueRows(unknownModes, (row) => `${row.actionId}|${row.mode}`),
    unknownProfiles: uniqueIssueRows(unknownProfiles, (row) => `${row.actionId}|${row.profile}`),
    requiredEntryActionMissing: uniqueIssueRows(requiredEntryActionMissing, (row) => row.actionId),
    staleHintTargets: uniqueIssueRows(staleHintTargets, (row) => `${row.hintId}|${row.actionId}|${row.reason}`),
    hintCommandMismatch: uniqueIssueRows(hintCommandMismatch, (row) => `${row.hintId}|${row.actionId}|${row.commandId}`),
  };

  const ok = !entryFlowDoc.blockingSurfaceExpansion
    && entryFlowDoc.nonBlockingClassification === 'advisory_until_machine_bound'
    && cleaned.commandBindingMissing.length === 0
    && cleaned.capabilityBindingMissing.length === 0
    && cleaned.staleEntryTargets.length === 0
    && cleaned.modeProfileVisibilityGaps.length === 0
    && cleaned.channelEntryInconsistency.length === 0
    && cleaned.unknownModes.length === 0
    && cleaned.unknownProfiles.length === 0
    && cleaned.requiredEntryActionMissing.length === 0
    && cleaned.staleHintTargets.length === 0
    && cleaned.hintCommandMismatch.length === 0;

  return {
    ok,
    projection,
    projectionHash,
    entryCount: entryFlowDoc.entries.length,
    requiredEntryActionCount: entryFlowDoc.requiredEntryActions.length,
    emptyStateHintCount: entryFlowDoc.emptyStateHints.length,
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

function evaluateX19Ws01FirstRunAndEmptyStateFlowState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const entryFlowDocPath = path.resolve(repoRoot, DEFAULT_ENTRY_FLOW_DOC_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const entryFlowRaw = readJsonObject(entryFlowDocPath);
  const menuGroupsRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingRaw = readJsonObject(capabilityBindingPath);

  const entryFlowDoc = normalizeEntryFlowDoc(entryFlowRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsRaw);
  const menuProjection = buildMenuProjection(menuGroups);
  const runtimeMeta = buildRuntimeCommandMeta();
  const capabilityBinding = parseCapabilityBindingDoc(capabilityBindingRaw);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const validateBaseline = () => validateEntryFlowDoc({
    entryFlowDoc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(entryFlowDoc);
  if (negative01Doc.entries[0]) {
    negative01Doc.entries[0].commandId = 'cmd.project.missing.binding';
  }
  const negative01 = validateEntryFlowDoc({
    entryFlowDoc: negative01Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative02Doc = deepClone(entryFlowDoc);
  if (negative02Doc.emptyStateHints[0]) {
    negative02Doc.emptyStateHints[0].actionId = 'stale-action-id';
  }
  const negative02 = validateEntryFlowDoc({
    entryFlowDoc: negative02Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative03Doc = deepClone(entryFlowDoc);
  if (negative03Doc.entries[0]) {
    negative03Doc.entries[0].modes = ['GhostMode'];
  }
  const negative03 = validateEntryFlowDoc({
    entryFlowDoc: negative03Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative04Doc = deepClone(entryFlowDoc);
  negative04Doc.entries = negative04Doc.entries.filter((row) => row.actionId !== 'help-open');
  const negative04 = validateEntryFlowDoc({
    entryFlowDoc: negative04Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative05Doc = deepClone(entryFlowDoc);
  if (negative05Doc.entries[0]) {
    negative05Doc.entries[0].channels.palette = 'hidden';
  }
  const negative05 = validateEntryFlowDoc({
    entryFlowDoc: negative05Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.commandBindingMissing.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.staleHintTargets.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.unknownModes.length > 0 || negative03.modeProfileVisibilityGaps.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.requiredEntryActionMissing.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.channelEntryInconsistency.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.commandBindingMissing.length === 0
      && baseline.capabilityBindingMissing.length === 0
      && baseline.requiredEntryActionMissing.length === 0,
    NEXT_TZ_POSITIVE_02: baseline.staleHintTargets.length === 0
      && baseline.hintCommandMismatch.length === 0,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: entryFlowDoc.blockingSurfaceExpansion === false,
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
    blockingSurfaceExpansion: entryFlowDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      entryCount: baseline.entryCount,
      requiredEntryActionCount: baseline.requiredEntryActionCount,
      emptyStateHintCount: baseline.emptyStateHintCount,
      commandBindingGapCount: baseline.commandBindingMissing.length,
      capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
      staleEntryTargetCount: baseline.staleEntryTargets.length,
      modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
      requiredEntryActionGapCount: baseline.requiredEntryActionMissing.length,
      staleHintTargetCount: baseline.staleHintTargets.length,
      hintCommandMismatchCount: baseline.hintCommandMismatch.length,
      channelEntryInconsistencyCount: baseline.channelEntryInconsistency.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      channelCount: entryFlowDoc.channels.length,
      modeCount: entryFlowDoc.modes.length,
      profileCount: entryFlowDoc.profiles.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    drift,
    detector: {
      detectorId: 'X19_WS01_ENTRY_FLOW_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          projectionHash: baseline.projectionHash,
          entryCount: baseline.entryCount,
          requiredEntryActionCount: baseline.requiredEntryActionCount,
          emptyStateHintCount: baseline.emptyStateHintCount,
        },
        counts: {
          commandBindingGapCount: baseline.commandBindingMissing.length,
          staleEntryTargetCount: baseline.staleEntryTargets.length,
          modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
          requiredEntryActionGapCount: baseline.requiredEntryActionMissing.length,
          staleHintTargetCount: baseline.staleHintTargets.length,
          hintCommandMismatchCount: baseline.hintCommandMismatch.length,
          channelEntryInconsistencyCount: baseline.channelEntryInconsistency.length,
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
      entryFlowDocPath: DEFAULT_ENTRY_FLOW_DOC_PATH,
      menuGroupsPath: DEFAULT_MENU_GROUPS_PATH,
      capabilityBindingPath: DEFAULT_COMMAND_CAPABILITY_BINDING_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX19Ws01FirstRunAndEmptyStateFlowState({
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
  console.log(`COMMAND_BINDING_GAP_COUNT=${state.counts.commandBindingGapCount}`);
  console.log(`STALE_HINT_TARGET_COUNT=${state.counts.staleHintTargetCount}`);
  console.log(`MODE_PROFILE_VISIBILITY_GAP_COUNT=${state.counts.modeProfileVisibilityGapCount}`);
  console.log(`REQUIRED_ENTRY_ACTION_GAP_COUNT=${state.counts.requiredEntryActionGapCount}`);
  console.log(`CHANNEL_ENTRY_INCONSISTENCY_COUNT=${state.counts.channelEntryInconsistencyCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX19Ws01FirstRunAndEmptyStateFlowState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
