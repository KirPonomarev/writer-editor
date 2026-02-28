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

const TOKEN_NAME = 'X20_WS01_RELEASE_CHECKLIST_AND_ONBOARDING_POLISH_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_BASELINE_DOC_PATH = 'docs/OPS/STATUS/X20_RELEASE_CHECKLIST_ONBOARDING_BASELINE_v1.json';
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

function normalizeBaselineDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const entries = Array.isArray(source.checklistEntries) ? source.checklistEntries : [];
  const hints = Array.isArray(source.onboardingHints) ? source.onboardingHints : [];

  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    releaseOnboardingVersion: normalizeString(source.releaseOnboardingVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { sort: false }),
    requiredChecklistItems: toUniqueStrings(source.requiredChecklistItems),
    checklistEntries: entries
      .map((row) => {
        const channels = isObjectRecord(row?.channels) ? row.channels : {};
        return {
          checklistId: normalizeString(row?.checklistId),
          actionId: normalizeString(row?.actionId),
          commandId: normalizeString(row?.commandId),
          checklistText: normalizeString(row?.checklistText),
          hintId: normalizeString(row?.hintId),
          channels: {
            menu: normalizeString(channels.menu).toLowerCase(),
            toolbar: normalizeString(channels.toolbar).toLowerCase(),
            palette: normalizeString(channels.palette).toLowerCase(),
          },
          modes: toUniqueStrings(row?.modes, { sort: false }),
          profiles: toUniqueStrings(row?.profiles, { sort: false }),
        };
      })
      .filter((row) => row.checklistId && row.actionId && row.commandId),
    onboardingHints: hints
      .map((row) => ({
        hintId: normalizeString(row?.hintId),
        actionId: normalizeString(row?.actionId),
        commandId: normalizeString(row?.commandId),
        entrySurface: normalizeString(row?.entrySurface),
        hintText: normalizeString(row?.hintText),
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

function validateBaseline({ checklistDoc, menuProjection, runtimeMeta, capabilityBinding }) {
  const commandBindingMissing = [];
  const capabilityBindingMissing = [];
  const modeProfileVisibilityGaps = [];
  const channelInconsistency = [];
  const unknownModes = [];
  const unknownProfiles = [];
  const requiredChecklistItemMissing = [];
  const staleHintTargets = [];
  const hintCommandMismatch = [];
  const checklistHintMissing = [];
  const duplicateChecklistItems = [];

  const modeSet = new Set(checklistDoc.modes);
  const profileSet = new Set(checklistDoc.profiles);

  const checklistIdCounts = new Map();
  const checklistActionMap = new Map(checklistDoc.checklistEntries.map((row) => [row.actionId, row]));
  const onboardingHintMap = new Map(checklistDoc.onboardingHints.map((row) => [row.hintId, row]));

  for (const row of checklistDoc.checklistEntries) {
    checklistIdCounts.set(row.checklistId, (checklistIdCounts.get(row.checklistId) || 0) + 1);
  }

  for (const [checklistId, count] of checklistIdCounts.entries()) {
    if (count > 1) {
      duplicateChecklistItems.push({ checklistId, count, reason: 'DUPLICATE_CHECKLIST_ID' });
    }
  }

  const checklistIdSet = new Set(checklistDoc.checklistEntries.map((row) => row.checklistId));
  for (const checklistId of checklistDoc.requiredChecklistItems) {
    if (!checklistIdSet.has(checklistId)) {
      requiredChecklistItemMissing.push({ checklistId, reason: 'REQUIRED_CHECKLIST_ITEM_MISSING' });
    }
  }

  const projectionRows = [];

  for (const row of checklistDoc.checklistEntries) {
    const commandMeta = runtimeMeta.get(row.commandId) || null;
    if (!commandMeta) {
      commandBindingMissing.push({ checklistId: row.checklistId, commandId: row.commandId, reason: 'COMMAND_NOT_REGISTERED' });
    }
    if (!capabilityBinding.has(row.commandId)) {
      capabilityBindingMissing.push({ checklistId: row.checklistId, commandId: row.commandId, reason: 'CAPABILITY_BINDING_MISSING' });
    }

    const channelValues = [row.channels.menu, row.channels.toolbar, row.channels.palette];
    if (new Set(channelValues).size !== 1) {
      channelInconsistency.push({ checklistId: row.checklistId, commandId: row.commandId, reason: 'CHANNEL_INCONSISTENCY' });
    }

    const hint = onboardingHintMap.get(row.hintId) || null;
    if (!hint) {
      checklistHintMissing.push({ checklistId: row.checklistId, hintId: row.hintId, reason: 'CHECKLIST_HINT_MISSING' });
    } else {
      if (hint.actionId !== row.actionId) {
        staleHintTargets.push({ checklistId: row.checklistId, hintId: row.hintId, reason: 'STALE_HINT_TARGET' });
      }
      if (hint.commandId !== row.commandId) {
        hintCommandMismatch.push({ checklistId: row.checklistId, hintId: row.hintId, reason: 'HINT_COMMAND_MISMATCH' });
      }
    }

    for (const mode of row.modes) {
      if (!modeSet.has(mode)) {
        unknownModes.push({ checklistId: row.checklistId, mode });
      }
      for (const profile of row.profiles) {
        if (!profileSet.has(profile)) {
          unknownProfiles.push({ checklistId: row.checklistId, profile });
        }

        const channels = menuProjection.get(`${row.commandId}|${mode}|${profile}`) || null;
        if (!channels) {
          modeProfileVisibilityGaps.push({ checklistId: row.checklistId, mode, profile, reason: 'MENU_VISIBILITY_RULE_MISSING' });
          continue;
        }

        if (row.channels.menu === 'visible' && channels.menu !== 'visible') {
          modeProfileVisibilityGaps.push({ checklistId: row.checklistId, mode, profile, reason: 'MENU_CHANNEL_MISMATCH' });
        }
        if (row.channels.toolbar === 'visible' && channels.toolbar !== 'visible') {
          modeProfileVisibilityGaps.push({ checklistId: row.checklistId, mode, profile, reason: 'TOOLBAR_CHANNEL_MISMATCH' });
        }
        if (row.channels.palette === 'visible' && channels.palette !== 'visible') {
          modeProfileVisibilityGaps.push({ checklistId: row.checklistId, mode, profile, reason: 'PALETTE_CHANNEL_MISMATCH' });
        }

        projectionRows.push({
          checklistId: row.checklistId,
          actionId: row.actionId,
          commandId: row.commandId,
          mode,
          profile,
        });
      }
    }
  }

  for (const hint of checklistDoc.onboardingHints) {
    const target = checklistActionMap.get(hint.actionId) || null;
    if (!target) {
      staleHintTargets.push({ hintId: hint.hintId, actionId: hint.actionId, reason: 'HINT_TARGET_ACTION_MISSING' });
      continue;
    }
    if (target.commandId !== hint.commandId) {
      hintCommandMismatch.push({ hintId: hint.hintId, actionId: hint.actionId, reason: 'HINT_TARGET_COMMAND_MISMATCH' });
    }
  }

  const projection = projectionRows.sort((a, b) => {
    const left = `${a.checklistId}|${a.actionId}|${a.mode}|${a.profile}`;
    const right = `${b.checklistId}|${b.actionId}|${b.mode}|${b.profile}`;
    return left.localeCompare(right);
  });
  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const cleaned = {
    commandBindingMissing: uniqueIssueRows(commandBindingMissing, (row) => `${row.checklistId}|${row.commandId}`),
    capabilityBindingMissing: uniqueIssueRows(capabilityBindingMissing, (row) => `${row.checklistId}|${row.commandId}`),
    modeProfileVisibilityGaps: uniqueIssueRows(modeProfileVisibilityGaps, (row) => `${row.checklistId}|${row.mode}|${row.profile}|${row.reason}`),
    channelInconsistency: uniqueIssueRows(channelInconsistency, (row) => `${row.checklistId}|${row.commandId}`),
    unknownModes: uniqueIssueRows(unknownModes, (row) => `${row.checklistId}|${row.mode}`),
    unknownProfiles: uniqueIssueRows(unknownProfiles, (row) => `${row.checklistId}|${row.profile}`),
    requiredChecklistItemMissing: uniqueIssueRows(requiredChecklistItemMissing, (row) => row.checklistId),
    staleHintTargets: uniqueIssueRows(staleHintTargets, (row) => `${row.hintId || ''}|${row.actionId || ''}|${row.reason}`),
    hintCommandMismatch: uniqueIssueRows(hintCommandMismatch, (row) => `${row.hintId || ''}|${row.checklistId || ''}|${row.reason}`),
    checklistHintMissing: uniqueIssueRows(checklistHintMissing, (row) => `${row.checklistId}|${row.hintId}`),
    duplicateChecklistItems: uniqueIssueRows(duplicateChecklistItems, (row) => row.checklistId),
  };

  const ok = !checklistDoc.blockingSurfaceExpansion
    && checklistDoc.nonBlockingClassification === 'advisory_until_machine_bound'
    && cleaned.commandBindingMissing.length === 0
    && cleaned.capabilityBindingMissing.length === 0
    && cleaned.modeProfileVisibilityGaps.length === 0
    && cleaned.channelInconsistency.length === 0
    && cleaned.unknownModes.length === 0
    && cleaned.unknownProfiles.length === 0
    && cleaned.requiredChecklistItemMissing.length === 0
    && cleaned.staleHintTargets.length === 0
    && cleaned.hintCommandMismatch.length === 0
    && cleaned.checklistHintMissing.length === 0
    && cleaned.duplicateChecklistItems.length === 0;

  return {
    ok,
    projection,
    projectionHash,
    entryCount: checklistDoc.checklistEntries.length,
    requiredChecklistItemCount: checklistDoc.requiredChecklistItems.length,
    onboardingHintCount: checklistDoc.onboardingHints.length,
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

function evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const checklistDocPath = path.resolve(repoRoot, DEFAULT_BASELINE_DOC_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const checklistRaw = readJsonObject(checklistDocPath);
  const menuGroupsRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingRaw = readJsonObject(capabilityBindingPath);

  const checklistDoc = normalizeBaselineDoc(checklistRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsRaw);
  const menuProjection = buildMenuProjection(menuGroups);
  const runtimeMeta = buildRuntimeCommandMeta();
  const capabilityBinding = parseCapabilityBindingDoc(capabilityBindingRaw);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const validateCurrent = () => validateBaseline({
    checklistDoc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const baseline = validateCurrent();
  const determinism = evaluateDeterminism(validateCurrent);

  const negative01Doc = deepClone(checklistDoc);
  if (negative01Doc.checklistEntries[0]) {
    negative01Doc.checklistEntries[0].commandId = 'cmd.project.missing.binding';
  }
  const negative01 = validateBaseline({ checklistDoc: negative01Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative02Doc = deepClone(checklistDoc);
  if (negative02Doc.onboardingHints[0]) {
    negative02Doc.onboardingHints[0].actionId = 'stale-action-id';
  }
  const negative02 = validateBaseline({ checklistDoc: negative02Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative03Doc = deepClone(checklistDoc);
  if (negative03Doc.checklistEntries[0]) {
    negative03Doc.checklistEntries[0].modes = ['GhostMode'];
  }
  const negative03 = validateBaseline({ checklistDoc: negative03Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative04Doc = deepClone(checklistDoc);
  if (negative04Doc.checklistEntries[0]) {
    negative04Doc.checklistEntries.push(deepClone(negative04Doc.checklistEntries[0]));
  }
  const negative04 = validateBaseline({ checklistDoc: negative04Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative05Doc = deepClone(checklistDoc);
  if (negative05Doc.checklistEntries[0]) {
    negative05Doc.checklistEntries[0].channels.palette = 'hidden';
  }
  const negative05 = validateBaseline({ checklistDoc: negative05Doc, menuProjection, runtimeMeta, capabilityBinding });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.commandBindingMissing.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.staleHintTargets.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.unknownModes.length > 0 || negative03.modeProfileVisibilityGaps.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.duplicateChecklistItems.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.channelInconsistency.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.commandBindingMissing.length === 0
      && baseline.staleHintTargets.length === 0
      && baseline.hintCommandMismatch.length === 0
      && baseline.requiredChecklistItemMissing.length === 0
      && baseline.checklistHintMissing.length === 0,
    NEXT_TZ_POSITIVE_02: baseline.capabilityBindingMissing.length === 0
      && baseline.modeProfileVisibilityGaps.length === 0
      && baseline.channelInconsistency.length === 0,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: checklistDoc.blockingSurfaceExpansion === false,
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
    blockingSurfaceExpansion: checklistDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      entryCount: baseline.entryCount,
      requiredChecklistItemCount: baseline.requiredChecklistItemCount,
      onboardingHintCount: baseline.onboardingHintCount,
      commandBindingGapCount: baseline.commandBindingMissing.length,
      capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
      modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
      channelInconsistencyCount: baseline.channelInconsistency.length,
      requiredChecklistItemGapCount: baseline.requiredChecklistItemMissing.length,
      staleHintTargetCount: baseline.staleHintTargets.length,
      hintCommandMismatchCount: baseline.hintCommandMismatch.length,
      checklistHintMissingCount: baseline.checklistHintMissing.length,
      duplicateChecklistItemCount: baseline.duplicateChecklistItems.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      channelCount: checklistDoc.channels.length,
      modeCount: checklistDoc.modes.length,
      profileCount: checklistDoc.profiles.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    drift,
    detector: {
      detectorId: 'X20_WS01_RELEASE_ONBOARDING_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          projectionHash: baseline.projectionHash,
          entryCount: baseline.entryCount,
          requiredChecklistItemCount: baseline.requiredChecklistItemCount,
          onboardingHintCount: baseline.onboardingHintCount,
        },
        counts: {
          commandBindingGapCount: baseline.commandBindingMissing.length,
          capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
          modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
          channelInconsistencyCount: baseline.channelInconsistency.length,
          requiredChecklistItemGapCount: baseline.requiredChecklistItemMissing.length,
          staleHintTargetCount: baseline.staleHintTargets.length,
          hintCommandMismatchCount: baseline.hintCommandMismatch.length,
          checklistHintMissingCount: baseline.checklistHintMissing.length,
          duplicateChecklistItemCount: baseline.duplicateChecklistItems.length,
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
      releaseOnboardingDocPath: DEFAULT_BASELINE_DOC_PATH,
      menuGroupsPath: DEFAULT_MENU_GROUPS_PATH,
      capabilityBindingPath: DEFAULT_COMMAND_CAPABILITY_BINDING_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState({
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
  console.log(`DUPLICATE_CHECKLIST_ITEM_COUNT=${state.counts.duplicateChecklistItemCount}`);
  console.log(`CHANNEL_INCONSISTENCY_COUNT=${state.counts.channelInconsistencyCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
