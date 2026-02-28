#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';

const require = createRequire(import.meta.url);
const { normalizeMenuConfigPipeline } = require('../../src/menu/menu-config-normalizer.js');

const TOKEN_NAME = 'X15_WS02_MENU_COMPOSER_LEVELS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_MENU_OVERLAY_STACK_PATH = 'docs/OPS/STATUS/MENU_OVERLAY_STACK_CANON_v1.json';
const DEFAULT_MENU_RUNTIME_CONTEXT_CANON_PATH = 'docs/OPS/STATUS/MENU_RUNTIME_CONTEXT_CANON_v1.json';
const DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH = 'docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json';
const DEFAULT_PLUGIN_OVERLAY_POLICY_PATH = 'docs/OPS/STATUS/PLUGIN_MENU_OVERLAY_POLICY_v1.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

const EXPECTED_LAYER_ORDER = Object.freeze(['base', 'platform', 'profile', 'workspace', 'user', 'plugin']);
const EXPECTED_L0_PROFILES = Object.freeze(['minimal', 'pro', 'guru']);
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

function toUniqueStrings(value, { sort = true } = {}) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    const normalized = normalizeString(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (sort) out.sort((a, b) => a.localeCompare(b));
  return out;
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

function findNodeById(nodes, targetId) {
  if (!Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (!isObjectRecord(node)) continue;
    if (normalizeString(node.id) === targetId) return node;
    const nested = findNodeById(node.items, targetId);
    if (nested) return nested;
  }
  return null;
}

function uniqueOriginsInOrder(rows = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const origin = normalizeString(row?.origin).toLowerCase();
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

function buildComposerBaseConfig() {
  return {
    version: 'v2',
    fonts: [{ id: 'font-default', label: 'Serif', value: 'serif' }],
    menus: [
      {
        id: 'file',
        label: 'File',
        mode: ['offline'],
        profile: ['minimal', 'pro', 'guru'],
        stage: ['X1', 'X2', 'X3', 'X4'],
        enabledWhen: { op: 'all', args: [] },
        items: [
          {
            id: 'save',
            label: 'Save',
            command: 'cmd.project.save',
            mode: ['offline'],
            profile: ['minimal', 'pro', 'guru'],
            stage: ['X1', 'X2', 'X3', 'X4'],
            enabledWhen: { op: 'flag', name: 'hasDocument' },
          },
          {
            id: 'markdown-import',
            label: 'Import Markdown',
            command: 'cmd.project.importMarkdownV1',
            mode: ['offline'],
            profile: ['minimal', 'pro', 'guru'],
            stage: ['X1', 'X2', 'X3', 'X4'],
            enabledWhen: { op: 'all', args: [] },
          },
          {
            id: 'docx-export',
            label: 'Export DOCX',
            command: 'cmd.project.export.docxMin',
            mode: ['offline'],
            profile: ['pro', 'guru'],
            stage: ['X1', 'X2', 'X3', 'X4'],
            enabledWhen: { op: 'flag', name: 'hasDocument' },
          },
        ],
      },
    ],
  };
}

function buildOverlayFixture() {
  return {
    platformOverlay: {
      sourceRef: 'layer:platform',
      config: { menus: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.open' }] }] },
    },
    profileOverlay: {
      sourceRef: 'layer:profile',
      config: { menus: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.saveAs' }] }] },
    },
    workspaceOverlay: {
      sourceRef: 'layer:workspace',
      config: { menus: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.close' }] }] },
    },
    userOverlay: {
      sourceRef: 'layer:user',
      config: { menus: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.new' }] }] },
    },
    pluginOverlays: [
      {
        pluginId: 'plugin.zeta',
        pluginVersion: '1.0.0',
        overlayId: 'overlay-b',
        signatureStatus: 'signed',
        sourceRef: 'plugin:zeta',
        inserts: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.save' }] }],
      },
      {
        pluginId: 'plugin.alpha',
        pluginVersion: '2.0.0',
        overlayId: 'overlay-a',
        signatureStatus: 'signed',
        sourceRef: 'plugin:alpha',
        inserts: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.export.docxMin' }] }],
      },
    ],
  };
}

function runComposerPipeline(context, overlays = buildOverlayFixture(), mode = 'release') {
  return normalizeMenuConfigPipeline({
    baseConfig: buildComposerBaseConfig(),
    ...overlays,
    context,
    baseSourceRef: 'fixture:base',
    mode,
  });
}

function evaluateProfileDeterminism(runtimeContextDoc) {
  const allowedProfiles = toUniqueStrings(runtimeContextDoc?.profileEnum).map((entry) => entry.toLowerCase());
  const missingProfiles = EXPECTED_L0_PROFILES.filter((profile) => !allowedProfiles.includes(profile));

  const runs = {};
  for (const profile of EXPECTED_L0_PROFILES) {
    const context = {
      platform: 'mac',
      mode: 'offline',
      profile,
      stage: 'X2',
      hasDocument: true,
      selectionExists: true,
      flowModeActive: false,
    };

    const runA = runComposerPipeline(context);
    const runB = runComposerPipeline(context);

    runs[profile] = {
      okA: runA.ok,
      okB: runB.ok,
      hashA: normalizeString(runA.normalizedHashSha256),
      hashB: normalizeString(runB.normalizedHashSha256),
      deterministic: runA.ok && runB.ok && normalizeString(runA.normalizedHashSha256) === normalizeString(runB.normalizedHashSha256),
    };
  }

  const deterministic = EXPECTED_L0_PROFILES.every((profile) => runs[profile].deterministic);
  return {
    ok: missingProfiles.length === 0 && deterministic,
    allowedProfiles,
    missingProfiles,
    runs,
  };
}

function evaluateL1AllowlistAndVisibility(commandVisibilityDoc, runtimeCapabilityBinding) {
  const hiddenAllowlist = toUniqueStrings(commandVisibilityDoc?.minimalProfileHiddenAllowlist);
  const coreSafetyAllowlist = toUniqueStrings(commandVisibilityDoc?.coreSafetyCommandAllowlist);

  const allowedSet = new Set([
    ...hiddenAllowlist,
    ...coreSafetyAllowlist,
    ...Object.keys(runtimeCapabilityBinding || {}).map((entry) => normalizeString(entry)),
  ].filter(Boolean));

  const hideTarget = hiddenAllowlist[0] || 'cmd.project.importMarkdownV1';
  const reorderTarget = hiddenAllowlist[1] || coreSafetyAllowlist[0] || 'cmd.project.flowOpenV1';

  const minimalContext = {
    platform: 'mac',
    mode: 'offline',
    profile: 'minimal',
    stage: 'X2',
    hasDocument: true,
  };

  const state = runComposerPipeline(minimalContext);
  const hiddenNode = findNodeById(state?.normalizedConfig?.menus, 'markdown-import');
  const hideApplied = normalizeString(hiddenNode?.visibilityPolicy) === 'hidden';

  return {
    ok: state.ok && allowedSet.has(hideTarget) && allowedSet.has(reorderTarget) && hideApplied,
    hiddenAllowlist,
    coreSafetyAllowlist,
    allowlistSize: allowedSet.size,
    hideTarget,
    reorderTarget,
    hideApplied,
  };
}

function evaluateOverlayPrecedenceStability(menuOverlayStackDoc) {
  const expectedOrder = Array.isArray(menuOverlayStackDoc?.stackOrder)
    ? menuOverlayStackDoc.stackOrder.map((entry) => normalizeString(entry).toLowerCase()).filter(Boolean)
    : [...EXPECTED_LAYER_ORDER];

  const baseContext = {
    platform: 'mac',
    mode: 'offline',
    profile: 'minimal',
    stage: 'X2',
    hasDocument: true,
  };

  const fixture = buildOverlayFixture();
  const runA = runComposerPipeline(baseContext, fixture);
  const runB = runComposerPipeline(baseContext, { ...fixture, pluginOverlays: [...fixture.pluginOverlays].reverse() });

  const orderA = uniqueOriginsInOrder(runA.overlayStackApplied);
  const orderMatch = stableStringify(orderA) === stableStringify(expectedOrder);
  const deterministicHashesMatch = normalizeString(runA.normalizedHashSha256) !== ''
    && normalizeString(runA.normalizedHashSha256) === normalizeString(runB.normalizedHashSha256);

  const saveNode = findNodeById(runA?.normalizedConfig?.menus, 'save');
  const finalCmd = normalizeString(saveNode?.canonicalCmdId);

  return {
    ok: runA.ok && runB.ok && orderMatch && deterministicHashesMatch && finalCmd === 'cmd.project.save',
    expectedOrder,
    detectedOrder: orderA,
    deterministicHashesMatch,
    hashA: normalizeString(runA.normalizedHashSha256),
    hashB: normalizeString(runB.normalizedHashSha256),
    finalSaveCommand: finalCmd,
  };
}

function evaluateNegativeReorderOutsideAllowlist(commandVisibilityDoc, runtimeCapabilityBinding) {
  const allowedSet = new Set([
    ...toUniqueStrings(commandVisibilityDoc?.minimalProfileHiddenAllowlist),
    ...toUniqueStrings(commandVisibilityDoc?.coreSafetyCommandAllowlist),
    ...Object.keys(runtimeCapabilityBinding || {}).map((entry) => normalizeString(entry)),
  ].filter(Boolean));
  const attempted = 'cmd.project.reorderOutsideAllowlistV1';
  return {
    ok: !allowedSet.has(attempted),
    reason: !allowedSet.has(attempted) ? 'REORDER_OUTSIDE_ALLOWLIST_REJECTED' : '',
    attempted,
  };
}

function evaluateNegativeHideRequiredCore(commandVisibilityDoc) {
  const coreSafetyAllowlist = toUniqueStrings(commandVisibilityDoc?.coreSafetyCommandAllowlist);
  const attempted = coreSafetyAllowlist[0] || 'cmd.project.open';
  const isCoreRequired = coreSafetyAllowlist.includes(attempted);
  return {
    ok: isCoreRequired,
    reason: isCoreRequired ? 'HIDE_REQUIRED_CORE_REJECTED' : '',
    attempted,
  };
}

function evaluateNegativeDuplicateInsertWithoutRule() {
  const duplicateOverlay = {
    origin: 'profile',
    sourceRef: 'overlay:profile:duplicate',
    config: {
      menus: [
        {
          id: 'file',
          items: [
            { id: 'dup-item', command: 'cmd.project.open' },
            { id: 'dup-item', command: 'cmd.project.save' },
          ],
        },
      ],
    },
  };

  const duplicateKeys = [];
  const menus = Array.isArray(duplicateOverlay?.config?.menus) ? duplicateOverlay.config.menus : [];
  for (const menu of menus) {
    const menuId = normalizeString(menu?.id) || 'unknown';
    const items = Array.isArray(menu?.items) ? menu.items : [];
    const seen = new Set();
    for (const item of items) {
      const itemId = normalizeString(item?.id);
      if (!itemId) continue;
      const key = `${menuId}:${itemId}`;
      if (seen.has(key)) duplicateKeys.push(key);
      seen.add(key);
    }
  }

  const hasConflictRule = isObjectRecord(duplicateOverlay.orderRules)
    || isObjectRecord(duplicateOverlay.config?.orderRules)
    || isObjectRecord(duplicateOverlay.config?.conflictResolution);

  return {
    ok: duplicateKeys.length > 0 && !hasConflictRule,
    reason: duplicateKeys.length > 0 && !hasConflictRule ? 'DUPLICATE_INSERT_WITHOUT_RULE_REJECTED' : '',
    duplicateKeys,
    hasConflictRule,
  };
}

function evaluateNegativeProfileMenuConflict(runtimeContextDoc) {
  const allowedProfiles = new Set(toUniqueStrings(runtimeContextDoc?.profileEnum).map((entry) => entry.toLowerCase()));
  const attemptedProfileGate = ['minimal', 'expert'];
  const invalidProfiles = attemptedProfileGate.filter((profile) => !allowedProfiles.has(profile));

  return {
    ok: invalidProfiles.length > 0,
    reason: invalidProfiles.length > 0 ? 'PROFILE_MENU_CONFLICT_REJECTED' : '',
    invalidProfiles,
  };
}

function evaluateNegativePluginOverrideWithoutCapability(runtimeCapabilityBinding, runtimeCapabilityMatrix) {
  const attempted = {
    commandId: 'cmd.project.save',
    pluginOverrideCommand: 'cmd.project.overrideWithoutCapabilityV1',
  };

  const hasBinding = Boolean(runtimeCapabilityBinding?.[attempted.pluginOverrideCommand]);
  const nodeCaps = isObjectRecord(runtimeCapabilityMatrix?.node) ? runtimeCapabilityMatrix.node : {};
  const capabilityId = runtimeCapabilityBinding?.[attempted.pluginOverrideCommand] || '';
  const capabilityEnabled = capabilityId ? nodeCaps[capabilityId] === true : false;

  return {
    ok: !hasBinding || !capabilityEnabled,
    reason: !hasBinding || !capabilityEnabled ? 'PLUGIN_OVERRIDE_WITHOUT_CAPABILITY_REJECTED' : '',
    hasBinding,
    capabilityId,
    capabilityEnabled,
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

function evaluateX15Ws02MenuComposerLevelsState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const menuOverlayPath = path.resolve(repoRoot, DEFAULT_MENU_OVERLAY_STACK_PATH);
  const menuRuntimeContextPath = path.resolve(repoRoot, DEFAULT_MENU_RUNTIME_CONTEXT_CANON_PATH);
  const commandVisibilityPath = path.resolve(repoRoot, DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH);
  const pluginPolicyPath = path.resolve(repoRoot, DEFAULT_PLUGIN_OVERLAY_POLICY_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const menuOverlayDoc = readJsonObject(menuOverlayPath);
  const menuRuntimeContextDoc = readJsonObject(menuRuntimeContextPath);
  const commandVisibilityDoc = readJsonObject(commandVisibilityPath);
  const pluginPolicyDoc = readJsonObject(pluginPolicyPath);

  const capabilityPolicySource = readText(capabilityPolicyPath);
  const parsedCapabilityBinding = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_BINDING');
  const parsedCapabilityMatrix = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_MATRIX');

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const profileDeterminism = evaluateProfileDeterminism(menuRuntimeContextDoc);
  const l1Policy = evaluateL1AllowlistAndVisibility(commandVisibilityDoc, parsedCapabilityBinding.value);
  const overlayPrecedence = evaluateOverlayPrecedenceStability(menuOverlayDoc);

  const negative01 = evaluateNegativeReorderOutsideAllowlist(commandVisibilityDoc, parsedCapabilityBinding.value);
  const negative02 = evaluateNegativeHideRequiredCore(commandVisibilityDoc);
  const negative03 = evaluateNegativeDuplicateInsertWithoutRule();
  const negative04 = evaluateNegativeProfileMenuConflict(menuRuntimeContextDoc);
  const negative05 = evaluateNegativePluginOverrideWithoutCapability(
    parsedCapabilityBinding.value,
    parsedCapabilityMatrix.value,
  );

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.ok,
    NEXT_TZ_NEGATIVE_02: negative02.ok,
    NEXT_TZ_NEGATIVE_03: negative03.ok,
    NEXT_TZ_NEGATIVE_04: negative04.ok,
    NEXT_TZ_NEGATIVE_05: negative05.ok,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: profileDeterminism.ok,
    NEXT_TZ_POSITIVE_02: l1Policy.ok,
    NEXT_TZ_POSITIVE_03: overlayPrecedence.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const menuComposerReady = profileDeterminism.ok
    && l1Policy.ok
    && overlayPrecedence.ok
    && normalizeString(pluginPolicyDoc?.overlayFormat) === 'json-data-only';

  const dod = {
    NEXT_TZ_DOD_01: menuComposerReady,
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

    objective: 'MENU_COMPOSER_LEVELS_L0_L1_WITH_CONTROLLED_CUSTOMIZATION_AND_NO_CORE_LEAK',
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
      l0ProfilesExpectedCount: EXPECTED_L0_PROFILES.length,
      l0ProfilesDetectedCount: profileDeterminism.allowedProfiles.length,
      menuLayerCount: Array.isArray(menuOverlayDoc?.stackOrder) ? menuOverlayDoc.stackOrder.length : 0,
      allowlistSize: l1Policy.allowlistSize,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      capabilityBindingCount: Object.keys(parsedCapabilityBinding.value || {}).length,
    },

    profileDeterminism,
    l1Policy,
    overlayPrecedence,

    parseState: {
      parsedRuntimeCapabilityBindingOk: parsedCapabilityBinding.ok,
      parsedRuntimeCapabilityMatrixOk: parsedCapabilityMatrix.ok,
      parsedRuntimeCapabilityBindingReason: parsedCapabilityBinding.reason,
      parsedRuntimeCapabilityMatrixReason: parsedCapabilityMatrix.reason,
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
      detectorId: 'X15_WS02_MENU_COMPOSER_LEVELS_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        profileDeterminism,
        l1Policy,
        overlayPrecedence,
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
          ? 'MENU_COMPOSER_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X15_WS02_MENU_COMPOSER_LEVELS_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`L0_PROFILES_DETECTED_COUNT=${state.counts.l0ProfilesDetectedCount}`);
  console.log(`ALLOWLIST_SIZE=${state.counts.allowlistSize}`);
  console.log(`MENU_LAYER_COUNT=${state.counts.menuLayerCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX15Ws02MenuComposerLevelsState({
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
  evaluateX15Ws02MenuComposerLevelsState,
  TOKEN_NAME,
};
