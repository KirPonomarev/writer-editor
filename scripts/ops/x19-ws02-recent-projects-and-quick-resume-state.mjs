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

const TOKEN_NAME = 'X19_WS02_RECENT_PROJECTS_AND_QUICK_RESUME_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_RECENT_RESUME_DOC_PATH = 'docs/OPS/STATUS/X19_RECENT_RESUME_BASELINE_v1.json';
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

function normalizeRecentResumeDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const entries = Array.isArray(source.recentEntries) ? source.recentEntries : [];
  const bindings = Array.isArray(source.quickResumeBindings) ? source.quickResumeBindings : [];
  const orderingPolicy = isObjectRecord(source.orderingPolicy) ? source.orderingPolicy : {};

  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    recentResumeVersion: normalizeString(source.recentResumeVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { sort: false }),
    requiredRecentActions: toUniqueStrings(source.requiredRecentActions),
    orderingPolicy: {
      primary: normalizeString(orderingPolicy.primary),
      secondary: normalizeString(orderingPolicy.secondary),
      strictDeterminism: orderingPolicy.strictDeterminism === true,
    },
    recentEntries: entries
      .map((row) => {
        const channels = isObjectRecord(row?.channels) ? row.channels : {};
        return {
          recentId: normalizeString(row?.recentId),
          recentRank: Number(row?.recentRank) || 0,
          actionId: normalizeString(row?.actionId),
          commandId: normalizeString(row?.commandId),
          projectId: normalizeString(row?.projectId),
          projectPath: normalizeString(row?.projectPath),
          lastOpenedAt: normalizeString(row?.lastOpenedAt),
          existsOnDisk: row?.existsOnDisk === true,
          channels: {
            menu: normalizeString(channels.menu).toLowerCase(),
            toolbar: normalizeString(channels.toolbar).toLowerCase(),
            palette: normalizeString(channels.palette).toLowerCase(),
          },
          modes: toUniqueStrings(row?.modes, { sort: false }),
          profiles: toUniqueStrings(row?.profiles, { sort: false }),
        };
      })
      .filter((row) => row.recentId && row.actionId && row.commandId),
    quickResumeBindings: bindings
      .map((row) => ({
        bindingId: normalizeString(row?.bindingId),
        actionId: normalizeString(row?.actionId),
        commandId: normalizeString(row?.commandId),
        projectPath: normalizeString(row?.projectPath),
      }))
      .filter((row) => row.bindingId && row.actionId && row.commandId),
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

function parseIsoTimestamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : NaN;
}

function isValidProjectPath(value) {
  const pathValue = normalizeString(value);
  if (!pathValue) return false;
  if (pathValue.startsWith('/')) return false;
  if (pathValue.includes('..')) return false;
  if (!pathValue.startsWith('projects/')) return false;
  if (!pathValue.endsWith('.json')) return false;
  return true;
}

function validateOrdering(entries) {
  for (let i = 0; i < entries.length; i += 1) {
    const expectedRank = i + 1;
    if (entries[i].recentRank !== expectedRank) {
      return false;
    }
    if (i > 0) {
      const prevTs = parseIsoTimestamp(entries[i - 1].lastOpenedAt);
      const currentTs = parseIsoTimestamp(entries[i].lastOpenedAt);
      if (!Number.isFinite(prevTs) || !Number.isFinite(currentTs) || prevTs < currentTs) {
        return false;
      }
    }
  }
  return true;
}

function validateRecentResumeDoc({ recentDoc, menuProjection, runtimeMeta, capabilityBinding }) {
  const invalidProjectPath = [];
  const commandBindingMissing = [];
  const capabilityBindingMissing = [];
  const staleRecentReference = [];
  const modeProfileVisibilityGaps = [];
  const channelInconsistency = [];
  const requiredActionMissing = [];
  const quickResumeBindingMissing = [];
  const quickResumeBindingMismatch = [];
  const unknownModes = [];
  const unknownProfiles = [];
  const orderingIssues = [];

  const modeSet = new Set(recentDoc.modes);
  const profileSet = new Set(recentDoc.profiles);
  const actionSet = new Set(recentDoc.recentEntries.map((row) => row.actionId));

  for (const actionId of recentDoc.requiredRecentActions) {
    if (!actionSet.has(actionId)) {
      requiredActionMissing.push({ actionId, reason: 'REQUIRED_RECENT_ACTION_MISSING' });
    }
  }

  const recentByAction = new Map(recentDoc.recentEntries.map((row) => [row.actionId, row]));
  const bindingByAction = new Map(recentDoc.quickResumeBindings.map((row) => [row.actionId, row]));

  const rankSet = new Set();
  for (const row of recentDoc.recentEntries) {
    if (rankSet.has(row.recentRank)) {
      orderingIssues.push({ actionId: row.actionId, recentRank: row.recentRank, reason: 'DUPLICATE_RECENT_RANK' });
    }
    rankSet.add(row.recentRank);
  }

  if (!validateOrdering(recentDoc.recentEntries)) {
    orderingIssues.push({ reason: 'ORDERING_POLICY_VIOLATION' });
  }

  const projectionRows = [];

  for (const row of recentDoc.recentEntries) {
    const commandMeta = runtimeMeta.get(row.commandId) || null;
    if (!commandMeta) {
      commandBindingMissing.push({ actionId: row.actionId, commandId: row.commandId, reason: 'COMMAND_NOT_REGISTERED' });
    }
    if (!capabilityBinding.has(row.commandId)) {
      capabilityBindingMissing.push({ actionId: row.actionId, commandId: row.commandId, reason: 'CAPABILITY_BINDING_MISSING' });
    }
    if (!isValidProjectPath(row.projectPath)) {
      invalidProjectPath.push({ actionId: row.actionId, projectPath: row.projectPath, reason: 'INVALID_PROJECT_PATH' });
    }
    if (row.existsOnDisk !== true) {
      staleRecentReference.push({ actionId: row.actionId, projectPath: row.projectPath, reason: 'STALE_RECENT_REFERENCE' });
    }

    const channelValues = [row.channels.menu, row.channels.toolbar, row.channels.palette];
    if (new Set(channelValues).size !== 1) {
      channelInconsistency.push({ actionId: row.actionId, commandId: row.commandId, reason: 'CHANNEL_INCONSISTENCY' });
    }

    const resumeBinding = bindingByAction.get(row.actionId) || null;
    if (!resumeBinding) {
      quickResumeBindingMissing.push({ actionId: row.actionId, reason: 'QUICK_RESUME_BINDING_MISSING' });
    } else {
      if (resumeBinding.commandId !== row.commandId || resumeBinding.projectPath !== row.projectPath) {
        quickResumeBindingMismatch.push({ actionId: row.actionId, reason: 'QUICK_RESUME_BINDING_MISMATCH' });
      }
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
          modeProfileVisibilityGaps.push({ actionId: row.actionId, mode, profile, reason: 'MENU_VISIBILITY_RULE_MISSING' });
          continue;
        }

        if (row.channels.menu === 'visible' && channels.menu !== 'visible') {
          modeProfileVisibilityGaps.push({ actionId: row.actionId, mode, profile, reason: 'MENU_CHANNEL_MISMATCH' });
        }
        if (row.channels.toolbar === 'visible' && channels.toolbar !== 'visible') {
          modeProfileVisibilityGaps.push({ actionId: row.actionId, mode, profile, reason: 'TOOLBAR_CHANNEL_MISMATCH' });
        }
        if (row.channels.palette === 'visible' && channels.palette !== 'visible') {
          modeProfileVisibilityGaps.push({ actionId: row.actionId, mode, profile, reason: 'PALETTE_CHANNEL_MISMATCH' });
        }

        projectionRows.push({
          actionId: row.actionId,
          commandId: row.commandId,
          projectId: row.projectId,
          projectPath: row.projectPath,
          mode,
          profile,
          recentRank: row.recentRank,
        });
      }
    }
  }

  for (const binding of recentDoc.quickResumeBindings) {
    const target = recentByAction.get(binding.actionId) || null;
    if (!target) {
      quickResumeBindingMismatch.push({ actionId: binding.actionId, reason: 'BINDING_TARGET_ACTION_MISSING' });
      continue;
    }
    if (binding.commandId !== target.commandId || binding.projectPath !== target.projectPath) {
      quickResumeBindingMismatch.push({ actionId: binding.actionId, reason: 'BINDING_TARGET_MISMATCH' });
    }
  }

  const projection = projectionRows.sort((a, b) => {
    const left = `${a.recentRank}|${a.actionId}|${a.mode}|${a.profile}`;
    const right = `${b.recentRank}|${b.actionId}|${b.mode}|${b.profile}`;
    return left.localeCompare(right);
  });
  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const cleaned = {
    invalidProjectPath: uniqueIssueRows(invalidProjectPath, (row) => `${row.actionId}|${row.projectPath}`),
    commandBindingMissing: uniqueIssueRows(commandBindingMissing, (row) => `${row.actionId}|${row.commandId}`),
    capabilityBindingMissing: uniqueIssueRows(capabilityBindingMissing, (row) => `${row.actionId}|${row.commandId}`),
    staleRecentReference: uniqueIssueRows(staleRecentReference, (row) => `${row.actionId}|${row.projectPath}`),
    modeProfileVisibilityGaps: uniqueIssueRows(modeProfileVisibilityGaps, (row) => `${row.actionId}|${row.mode}|${row.profile}|${row.reason}`),
    channelInconsistency: uniqueIssueRows(channelInconsistency, (row) => `${row.actionId}|${row.commandId}`),
    requiredActionMissing: uniqueIssueRows(requiredActionMissing, (row) => row.actionId),
    quickResumeBindingMissing: uniqueIssueRows(quickResumeBindingMissing, (row) => row.actionId),
    quickResumeBindingMismatch: uniqueIssueRows(quickResumeBindingMismatch, (row) => `${row.actionId}|${row.reason}`),
    unknownModes: uniqueIssueRows(unknownModes, (row) => `${row.actionId}|${row.mode}`),
    unknownProfiles: uniqueIssueRows(unknownProfiles, (row) => `${row.actionId}|${row.profile}`),
    orderingIssues: uniqueIssueRows(orderingIssues, (row) => `${row.actionId || 'none'}|${row.reason}|${row.recentRank || 0}`),
  };

  const orderingPolicyValid = recentDoc.orderingPolicy.primary === 'lastOpenedAt_desc'
    && recentDoc.orderingPolicy.secondary === 'recentRank_asc'
    && recentDoc.orderingPolicy.strictDeterminism === true;

  const ok = !recentDoc.blockingSurfaceExpansion
    && recentDoc.nonBlockingClassification === 'advisory_until_machine_bound'
    && orderingPolicyValid
    && cleaned.invalidProjectPath.length === 0
    && cleaned.commandBindingMissing.length === 0
    && cleaned.capabilityBindingMissing.length === 0
    && cleaned.staleRecentReference.length === 0
    && cleaned.modeProfileVisibilityGaps.length === 0
    && cleaned.channelInconsistency.length === 0
    && cleaned.requiredActionMissing.length === 0
    && cleaned.quickResumeBindingMissing.length === 0
    && cleaned.quickResumeBindingMismatch.length === 0
    && cleaned.unknownModes.length === 0
    && cleaned.unknownProfiles.length === 0
    && cleaned.orderingIssues.length === 0;

  return {
    ok,
    orderingPolicyValid,
    projection,
    projectionHash,
    entryCount: recentDoc.recentEntries.length,
    requiredRecentActionCount: recentDoc.requiredRecentActions.length,
    quickResumeBindingCount: recentDoc.quickResumeBindings.length,
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

function evaluateX19Ws02RecentProjectsAndQuickResumeState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const recentDocPath = path.resolve(repoRoot, DEFAULT_RECENT_RESUME_DOC_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const recentDocRaw = readJsonObject(recentDocPath);
  const menuGroupsRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingRaw = readJsonObject(capabilityBindingPath);

  const recentDoc = normalizeRecentResumeDoc(recentDocRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsRaw);
  const menuProjection = buildMenuProjection(menuGroups);
  const runtimeMeta = buildRuntimeCommandMeta();
  const capabilityBinding = parseCapabilityBindingDoc(capabilityBindingRaw);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const validateBaseline = () => validateRecentResumeDoc({
    recentDoc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(recentDoc);
  if (negative01Doc.recentEntries[0]) {
    negative01Doc.recentEntries[0].projectPath = '../outside/project.craftsman.json';
  }
  const negative01 = validateRecentResumeDoc({
    recentDoc: negative01Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative02Doc = deepClone(recentDoc);
  negative02Doc.quickResumeBindings = negative02Doc.quickResumeBindings.filter((row) => row.actionId !== 'quick-resume-last');
  const negative02 = validateRecentResumeDoc({
    recentDoc: negative02Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative03Doc = deepClone(recentDoc);
  if (negative03Doc.recentEntries[1]) {
    negative03Doc.recentEntries[1].existsOnDisk = false;
  }
  const negative03 = validateRecentResumeDoc({
    recentDoc: negative03Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative04Doc = deepClone(recentDoc);
  if (negative04Doc.recentEntries[0]) {
    negative04Doc.recentEntries[0].modes = ['GhostMode'];
  }
  const negative04 = validateRecentResumeDoc({
    recentDoc: negative04Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative05Doc = deepClone(recentDoc);
  if (negative05Doc.recentEntries[0]) {
    negative05Doc.recentEntries[0].channels.palette = 'hidden';
  }
  const negative05 = validateRecentResumeDoc({
    recentDoc: negative05Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.invalidProjectPath.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.quickResumeBindingMissing.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.staleRecentReference.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.unknownModes.length > 0 || negative04.modeProfileVisibilityGaps.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.channelInconsistency.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.orderingPolicyValid
      && baseline.orderingIssues.length === 0
      && baseline.requiredActionMissing.length === 0,
    NEXT_TZ_POSITIVE_02: baseline.commandBindingMissing.length === 0
      && baseline.capabilityBindingMissing.length === 0
      && baseline.quickResumeBindingMissing.length === 0
      && baseline.quickResumeBindingMismatch.length === 0,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: recentDoc.blockingSurfaceExpansion === false,
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
    blockingSurfaceExpansion: recentDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      entryCount: baseline.entryCount,
      requiredRecentActionCount: baseline.requiredRecentActionCount,
      quickResumeBindingCount: baseline.quickResumeBindingCount,
      invalidProjectPathCount: baseline.invalidProjectPath.length,
      commandBindingGapCount: baseline.commandBindingMissing.length,
      capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
      staleRecentReferenceCount: baseline.staleRecentReference.length,
      modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
      requiredActionGapCount: baseline.requiredActionMissing.length,
      quickResumeBindingMissingCount: baseline.quickResumeBindingMissing.length,
      quickResumeBindingMismatchCount: baseline.quickResumeBindingMismatch.length,
      channelInconsistencyCount: baseline.channelInconsistency.length,
      orderingIssueCount: baseline.orderingIssues.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      channelCount: recentDoc.channels.length,
      modeCount: recentDoc.modes.length,
      profileCount: recentDoc.profiles.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    drift,
    detector: {
      detectorId: 'X19_WS02_RECENT_RESUME_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          projectionHash: baseline.projectionHash,
          entryCount: baseline.entryCount,
          requiredRecentActionCount: baseline.requiredRecentActionCount,
          quickResumeBindingCount: baseline.quickResumeBindingCount,
        },
        counts: {
          invalidProjectPathCount: baseline.invalidProjectPath.length,
          commandBindingGapCount: baseline.commandBindingMissing.length,
          staleRecentReferenceCount: baseline.staleRecentReference.length,
          modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
          requiredActionGapCount: baseline.requiredActionMissing.length,
          quickResumeBindingMissingCount: baseline.quickResumeBindingMissing.length,
          channelInconsistencyCount: baseline.channelInconsistency.length,
          orderingIssueCount: baseline.orderingIssues.length,
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
      recentResumeDocPath: DEFAULT_RECENT_RESUME_DOC_PATH,
      menuGroupsPath: DEFAULT_MENU_GROUPS_PATH,
      capabilityBindingPath: DEFAULT_COMMAND_CAPABILITY_BINDING_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX19Ws02RecentProjectsAndQuickResumeState({
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
  console.log(`INVALID_PROJECT_PATH_COUNT=${state.counts.invalidProjectPathCount}`);
  console.log(`QUICK_RESUME_BINDING_MISSING_COUNT=${state.counts.quickResumeBindingMissingCount}`);
  console.log(`STALE_RECENT_REFERENCE_COUNT=${state.counts.staleRecentReferenceCount}`);
  console.log(`MODE_PROFILE_VISIBILITY_GAP_COUNT=${state.counts.modeProfileVisibilityGapCount}`);
  console.log(`CHANNEL_INCONSISTENCY_COUNT=${state.counts.channelInconsistencyCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX19Ws02RecentProjectsAndQuickResumeState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
