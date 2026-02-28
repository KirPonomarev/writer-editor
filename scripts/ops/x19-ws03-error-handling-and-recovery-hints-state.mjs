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

const TOKEN_NAME = 'X19_WS03_ERROR_HANDLING_AND_RECOVERY_HINTS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_ERROR_HINTS_DOC_PATH = 'docs/OPS/STATUS/X19_ERROR_RECOVERY_HINTS_BASELINE_v1.json';
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

function normalizeErrorHintsDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const resetPolicy = isObjectRecord(source.resetPolicy) ? source.resetPolicy : {};

  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    errorRecoveryHintsVersion: normalizeString(source.errorRecoveryHintsVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { sort: false }),
    targetFlows: toUniqueStrings(source.targetFlows, { sort: false }),
    errorStates: toUniqueStrings(source.errorStates, { sort: false }),
    requiredErrorSignals: toUniqueStrings(source.requiredErrorSignals),
    requiredRecoveryPathErrorCodes: toUniqueStrings(source.requiredRecoveryPathErrorCodes),
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
          flow: normalizeString(row?.flow),
          commandId: normalizeString(row?.commandId),
          sourceEvent: normalizeString(row?.sourceEvent),
          errorState: normalizeString(row?.errorState).toLowerCase(),
          errorCode: normalizeString(row?.errorCode),
          hintId: normalizeString(row?.hintId),
          hintText: normalizeString(row?.hintText),
          recoveryHint: normalizeString(row?.recoveryHint),
          timeoutMs: Number(row?.timeoutMs) || 0,
          resetOn: toUniqueStrings(row?.resetOn),
          channels: {
            menu: normalizeString(channels.menu).toLowerCase(),
            toolbar: normalizeString(channels.toolbar).toLowerCase(),
            palette: normalizeString(channels.palette).toLowerCase(),
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

function validateErrorHintsDoc({
  hintsDoc,
  menuProjection,
  runtimeMeta,
  capabilityBinding,
}) {
  const hintMappingMissing = [];
  const recoveryHintMissing = [];
  const sourceEventMissing = [];
  const sourceEventNotAllowed = [];
  const commandBindingMissing = [];
  const capabilityBindingMissing = [];
  const modeProfileVisibilityGaps = [];
  const channelErrorFeedbackInconsistency = [];
  const statusResetGaps = [];
  const unknownModes = [];
  const unknownProfiles = [];
  const unknownFlows = [];
  const unknownErrorStates = [];
  const requiredErrorSignalMissing = [];
  const requiredRecoveryPathErrorCodeMissing = [];

  const modeSet = new Set(hintsDoc.modes);
  const profileSet = new Set(hintsDoc.profiles);
  const flowSet = new Set(hintsDoc.targetFlows);
  const errorStateSet = new Set(hintsDoc.errorStates);
  const allowedEvents = new Set(hintsDoc.allowedSourceEvents);

  const signalIdSet = new Set(hintsDoc.entries.map((row) => row.signalId));
  for (const signalId of hintsDoc.requiredErrorSignals) {
    if (!signalIdSet.has(signalId)) {
      requiredErrorSignalMissing.push({ signalId, reason: 'REQUIRED_ERROR_SIGNAL_MISSING' });
    }
  }

  for (const errorCode of hintsDoc.requiredRecoveryPathErrorCodes) {
    const hasRecovery = hintsDoc.entries.some((row) => row.errorCode === errorCode && normalizeString(row.recoveryHint));
    if (!hasRecovery) {
      requiredRecoveryPathErrorCodeMissing.push({ errorCode, reason: 'REQUIRED_RECOVERY_PATH_ERROR_CODE_MISSING' });
    }
  }

  const projectionRows = [];

  for (const row of hintsDoc.entries) {
    const commandMeta = runtimeMeta.get(row.commandId) || null;

    if (!row.hintId || !row.hintText) {
      hintMappingMissing.push({ signalId: row.signalId, reason: 'HINT_MAPPING_MISSING' });
    }

    if (!row.sourceEvent) {
      sourceEventMissing.push({ signalId: row.signalId, reason: 'SOURCE_EVENT_MISSING' });
    } else if (!allowedEvents.has(row.sourceEvent)) {
      sourceEventNotAllowed.push({ signalId: row.signalId, sourceEvent: row.sourceEvent, reason: 'SOURCE_EVENT_NOT_ALLOWED' });
    }

    if (!commandMeta) {
      commandBindingMissing.push({ signalId: row.signalId, commandId: row.commandId, reason: 'COMMAND_NOT_REGISTERED' });
    }
    if (!capabilityBinding.has(row.commandId)) {
      capabilityBindingMissing.push({ signalId: row.signalId, commandId: row.commandId, reason: 'CAPABILITY_BINDING_MISSING' });
    }

    if (!flowSet.has(row.flow)) {
      unknownFlows.push({ signalId: row.signalId, flow: row.flow, reason: 'UNKNOWN_FLOW' });
    }
    if (!errorStateSet.has(row.errorState)) {
      unknownErrorStates.push({ signalId: row.signalId, errorState: row.errorState, reason: 'UNKNOWN_ERROR_STATE' });
    }

    if (hintsDoc.requiredRecoveryPathErrorCodes.includes(row.errorCode) && !normalizeString(row.recoveryHint)) {
      recoveryHintMissing.push({ signalId: row.signalId, errorCode: row.errorCode, reason: 'RECOVERY_HINT_MISSING' });
    }

    const channelValues = [row.channels.menu, row.channels.toolbar, row.channels.palette];
    if (new Set(channelValues).size !== 1) {
      channelErrorFeedbackInconsistency.push({ signalId: row.signalId, reason: 'CHANNEL_ERROR_FEEDBACK_INCONSISTENT' });
    }

    if (row.timeoutMs <= 0) {
      statusResetGaps.push({ signalId: row.signalId, timeoutMs: row.timeoutMs, reason: 'INVALID_TIMEOUT' });
    }
    if (hintsDoc.resetPolicy.maxTimeoutMs > 0 && row.timeoutMs > hintsDoc.resetPolicy.maxTimeoutMs) {
      statusResetGaps.push({ signalId: row.signalId, timeoutMs: row.timeoutMs, reason: 'TIMEOUT_EXCEEDS_MAX' });
    }
    if (row.resetOn.length === 0) {
      statusResetGaps.push({ signalId: row.signalId, reason: 'RESET_RULES_MISSING' });
    }
    for (const resetEvent of row.resetOn) {
      if (!allowedEvents.has(resetEvent)) {
        statusResetGaps.push({ signalId: row.signalId, resetEvent, reason: 'RESET_EVENT_NOT_ALLOWED' });
      }
    }

    for (const mode of row.modes) {
      if (!modeSet.has(mode)) {
        unknownModes.push({ signalId: row.signalId, mode, reason: 'UNKNOWN_MODE' });
      }
      for (const profile of row.profiles) {
        if (!profileSet.has(profile)) {
          unknownProfiles.push({ signalId: row.signalId, profile, reason: 'UNKNOWN_PROFILE' });
        }

        const channels = menuProjection.get(`${row.commandId}|${mode}|${profile}`) || null;
        if (!channels) {
          modeProfileVisibilityGaps.push({ signalId: row.signalId, mode, profile, reason: 'MENU_VISIBILITY_RULE_MISSING' });
          continue;
        }

        if (row.channels.menu === 'visible' && channels.menu !== 'visible') {
          modeProfileVisibilityGaps.push({ signalId: row.signalId, mode, profile, reason: 'MENU_CHANNEL_MISMATCH' });
        }
        if (row.channels.toolbar === 'visible' && channels.toolbar !== 'visible') {
          modeProfileVisibilityGaps.push({ signalId: row.signalId, mode, profile, reason: 'TOOLBAR_CHANNEL_MISMATCH' });
        }
        if (row.channels.palette === 'visible' && channels.palette !== 'visible') {
          modeProfileVisibilityGaps.push({ signalId: row.signalId, mode, profile, reason: 'PALETTE_CHANNEL_MISMATCH' });
        }

        projectionRows.push({
          signalId: row.signalId,
          flow: row.flow,
          errorCode: row.errorCode,
          commandId: row.commandId,
          mode,
          profile,
        });
      }
    }
  }

  const projection = projectionRows.sort((a, b) => {
    const left = `${a.signalId}|${a.flow}|${a.mode}|${a.profile}`;
    const right = `${b.signalId}|${b.flow}|${b.mode}|${b.profile}`;
    return left.localeCompare(right);
  });
  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const cleaned = {
    hintMappingMissing: uniqueIssueRows(hintMappingMissing, (row) => `${row.signalId}|${row.reason}`),
    recoveryHintMissing: uniqueIssueRows(recoveryHintMissing, (row) => `${row.signalId}|${row.errorCode}`),
    sourceEventMissing: uniqueIssueRows(sourceEventMissing, (row) => `${row.signalId}|${row.reason}`),
    sourceEventNotAllowed: uniqueIssueRows(sourceEventNotAllowed, (row) => `${row.signalId}|${row.sourceEvent}`),
    commandBindingMissing: uniqueIssueRows(commandBindingMissing, (row) => `${row.signalId}|${row.commandId}`),
    capabilityBindingMissing: uniqueIssueRows(capabilityBindingMissing, (row) => `${row.signalId}|${row.commandId}`),
    modeProfileVisibilityGaps: uniqueIssueRows(modeProfileVisibilityGaps, (row) => `${row.signalId}|${row.mode}|${row.profile}|${row.reason}`),
    channelErrorFeedbackInconsistency: uniqueIssueRows(channelErrorFeedbackInconsistency, (row) => `${row.signalId}|${row.reason}`),
    statusResetGaps: uniqueIssueRows(statusResetGaps, (row) => `${row.signalId}|${row.reason}|${row.timeoutMs || 0}|${row.resetEvent || ''}`),
    unknownModes: uniqueIssueRows(unknownModes, (row) => `${row.signalId}|${row.mode}`),
    unknownProfiles: uniqueIssueRows(unknownProfiles, (row) => `${row.signalId}|${row.profile}`),
    unknownFlows: uniqueIssueRows(unknownFlows, (row) => `${row.signalId}|${row.flow}`),
    unknownErrorStates: uniqueIssueRows(unknownErrorStates, (row) => `${row.signalId}|${row.errorState}`),
    requiredErrorSignalMissing: uniqueIssueRows(requiredErrorSignalMissing, (row) => row.signalId),
    requiredRecoveryPathErrorCodeMissing: uniqueIssueRows(requiredRecoveryPathErrorCodeMissing, (row) => row.errorCode),
  };

  const resetPolicyValid = hintsDoc.resetPolicy.defaultTimeoutMs > 0
    && hintsDoc.resetPolicy.maxTimeoutMs >= hintsDoc.resetPolicy.defaultTimeoutMs
    && hintsDoc.resetPolicy.onModeSwitchReset === true
    && hintsDoc.resetPolicy.onProfileSwitchReset === true;

  const ok = !hintsDoc.blockingSurfaceExpansion
    && hintsDoc.nonBlockingClassification === 'advisory_until_machine_bound'
    && resetPolicyValid
    && cleaned.hintMappingMissing.length === 0
    && cleaned.recoveryHintMissing.length === 0
    && cleaned.sourceEventMissing.length === 0
    && cleaned.sourceEventNotAllowed.length === 0
    && cleaned.commandBindingMissing.length === 0
    && cleaned.capabilityBindingMissing.length === 0
    && cleaned.modeProfileVisibilityGaps.length === 0
    && cleaned.channelErrorFeedbackInconsistency.length === 0
    && cleaned.statusResetGaps.length === 0
    && cleaned.unknownModes.length === 0
    && cleaned.unknownProfiles.length === 0
    && cleaned.unknownFlows.length === 0
    && cleaned.unknownErrorStates.length === 0
    && cleaned.requiredErrorSignalMissing.length === 0
    && cleaned.requiredRecoveryPathErrorCodeMissing.length === 0;

  return {
    ok,
    resetPolicyValid,
    projection,
    projectionHash,
    entryCount: hintsDoc.entries.length,
    requiredErrorSignalCount: hintsDoc.requiredErrorSignals.length,
    requiredRecoveryPathErrorCodeCount: hintsDoc.requiredRecoveryPathErrorCodes.length,
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

function evaluateX19Ws03ErrorHandlingAndRecoveryHintsState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const errorHintsDocPath = path.resolve(repoRoot, DEFAULT_ERROR_HINTS_DOC_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const hintsDocRaw = readJsonObject(errorHintsDocPath);
  const menuGroupsRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingRaw = readJsonObject(capabilityBindingPath);

  const hintsDoc = normalizeErrorHintsDoc(hintsDocRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsRaw);
  const menuProjection = buildMenuProjection(menuGroups);
  const runtimeMeta = buildRuntimeCommandMeta();
  const capabilityBinding = parseCapabilityBindingDoc(capabilityBindingRaw);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const validateBaseline = () => validateErrorHintsDoc({
    hintsDoc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(hintsDoc);
  if (negative01Doc.entries[0]) {
    negative01Doc.entries[0].hintId = '';
    negative01Doc.entries[0].hintText = '';
  }
  const negative01 = validateErrorHintsDoc({ hintsDoc: negative01Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative02Doc = deepClone(hintsDoc);
  const stalePathEntry = negative02Doc.entries.find((row) => row.errorCode === 'RESUME_STALE_PATH');
  if (stalePathEntry) stalePathEntry.recoveryHint = '';
  const negative02 = validateErrorHintsDoc({ hintsDoc: negative02Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative03Doc = deepClone(hintsDoc);
  if (negative03Doc.entries[0]) negative03Doc.entries[0].modes = ['GhostMode'];
  const negative03 = validateErrorHintsDoc({ hintsDoc: negative03Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative04Doc = deepClone(hintsDoc);
  if (negative04Doc.entries[0]) {
    negative04Doc.entries[0].timeoutMs = 0;
    negative04Doc.entries[0].resetOn = [];
  }
  const negative04 = validateErrorHintsDoc({ hintsDoc: negative04Doc, menuProjection, runtimeMeta, capabilityBinding });

  const negative05Doc = deepClone(hintsDoc);
  if (negative05Doc.entries[0]) negative05Doc.entries[0].channels.palette = 'hidden';
  const negative05 = validateErrorHintsDoc({ hintsDoc: negative05Doc, menuProjection, runtimeMeta, capabilityBinding });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.hintMappingMissing.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.recoveryHintMissing.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.unknownModes.length > 0 || negative03.modeProfileVisibilityGaps.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.statusResetGaps.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.channelErrorFeedbackInconsistency.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.hintMappingMissing.length === 0
      && baseline.requiredErrorSignalMissing.length === 0
      && baseline.sourceEventMissing.length === 0
      && baseline.sourceEventNotAllowed.length === 0,
    NEXT_TZ_POSITIVE_02: baseline.recoveryHintMissing.length === 0
      && baseline.requiredRecoveryPathErrorCodeMissing.length === 0,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: hintsDoc.blockingSurfaceExpansion === false,
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
    blockingSurfaceExpansion: hintsDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      entryCount: baseline.entryCount,
      requiredErrorSignalCount: baseline.requiredErrorSignalCount,
      requiredRecoveryPathErrorCodeCount: baseline.requiredRecoveryPathErrorCodeCount,
      hintMappingGapCount: baseline.hintMappingMissing.length,
      recoveryHintGapCount: baseline.recoveryHintMissing.length,
      sourceEventGapCount: baseline.sourceEventMissing.length + baseline.sourceEventNotAllowed.length,
      commandBindingGapCount: baseline.commandBindingMissing.length,
      capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
      modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
      statusResetGapCount: baseline.statusResetGaps.length,
      channelErrorFeedbackInconsistencyCount: baseline.channelErrorFeedbackInconsistency.length,
      requiredErrorSignalGapCount: baseline.requiredErrorSignalMissing.length,
      requiredRecoveryPathErrorCodeGapCount: baseline.requiredRecoveryPathErrorCodeMissing.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      channelCount: hintsDoc.channels.length,
      modeCount: hintsDoc.modes.length,
      profileCount: hintsDoc.profiles.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    drift,
    detector: {
      detectorId: 'X19_WS03_ERROR_RECOVERY_HINTS_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          projectionHash: baseline.projectionHash,
          entryCount: baseline.entryCount,
          requiredErrorSignalCount: baseline.requiredErrorSignalCount,
          requiredRecoveryPathErrorCodeCount: baseline.requiredRecoveryPathErrorCodeCount,
        },
        counts: {
          hintMappingGapCount: baseline.hintMappingMissing.length,
          recoveryHintGapCount: baseline.recoveryHintMissing.length,
          sourceEventGapCount: baseline.sourceEventMissing.length + baseline.sourceEventNotAllowed.length,
          commandBindingGapCount: baseline.commandBindingMissing.length,
          capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
          modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
          statusResetGapCount: baseline.statusResetGaps.length,
          channelErrorFeedbackInconsistencyCount: baseline.channelErrorFeedbackInconsistency.length,
          requiredErrorSignalGapCount: baseline.requiredErrorSignalMissing.length,
          requiredRecoveryPathErrorCodeGapCount: baseline.requiredRecoveryPathErrorCodeMissing.length,
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
      errorHintsDocPath: DEFAULT_ERROR_HINTS_DOC_PATH,
      menuGroupsPath: DEFAULT_MENU_GROUPS_PATH,
      capabilityBindingPath: DEFAULT_COMMAND_CAPABILITY_BINDING_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX19Ws03ErrorHandlingAndRecoveryHintsState({
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
  console.log(`HINT_MAPPING_GAP_COUNT=${state.counts.hintMappingGapCount}`);
  console.log(`RECOVERY_HINT_GAP_COUNT=${state.counts.recoveryHintGapCount}`);
  console.log(`STATUS_RESET_GAP_COUNT=${state.counts.statusResetGapCount}`);
  console.log(`MODE_PROFILE_VISIBILITY_GAP_COUNT=${state.counts.modeProfileVisibilityGapCount}`);
  console.log(`CHANNEL_ERROR_FEEDBACK_INCONSISTENCY_COUNT=${state.counts.channelErrorFeedbackInconsistencyCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
