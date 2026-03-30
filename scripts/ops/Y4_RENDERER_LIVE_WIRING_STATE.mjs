#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLayoutPatchFromSpatialState,
  createRepoGroundedDesignOsBrowserRuntime,
  mapEditorModeToWorkspace,
} from '../../src/renderer/design-os/index.mjs';

const TASK_ID = 'YALKEN_DESIGN_OS_Y4_RENDERER_LIVE_WIRING_001';
const FAIL_REASON_FORCED_NEGATIVE = 'E_Y4_RENDERER_LIVE_WIRING_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_Y4_RENDERER_LIVE_WIRING_UNEXPECTED';
const Y4_MARKER = 'Y4_RENDERER_LIVE_WIRING_ACTIVE';
const EDITOR_SOURCE_PATH = 'src/renderer/editor.js';
const EDITOR_BUNDLE_PATH = 'src/renderer/editor.bundle.js';
const X15_PRESET_SCHEMA_PATH = 'docs/OPS/STATUS/X15_PROFILE_PRESETS_SCHEMA_v1.json';
const X15_MODE_POLICY_PATH = 'docs/OPS/STATUS/X15_MODE_SHELL_POLICY_v1.json';

const REQUIRED_PHASE04_LOCKED_TARGETS = Object.freeze([
  'DESIGN_LAYER_BASELINE',
  'TOKENS',
  'TYPOGRAPHY',
  'SKINS',
  'SUPPORTED_MODES',
]);

const POLICY_MODE_BY_EDITOR_MODE = Object.freeze({
  write: 'Write',
  plan: 'Plan',
  review: 'Review',
});

const RUNTIME_PROFILE_BY_PRESET = Object.freeze({
  minimal: 'LEGACY_MINIMAL',
  pro: 'LEGACY_PRO',
  guru: 'LEGACY_GURU',
});

const FALLBACK_RUNTIME_PROFILE_BY_EDITOR_MODE = Object.freeze({
  write: 'LEGACY_MINIMAL',
  plan: 'LEGACY_GURU',
  review: 'LEGACY_PRO',
});

const SHELL_MODE_BY_EDITOR_MODE = Object.freeze({
  write: 'CALM_DOCKED',
  plan: 'COMPACT_DOCKED',
  review: 'SPATIAL_ADVANCED',
});

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJson(relativePath) {
  const absolutePath = path.resolve(relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function readText(relativePath) {
  const absolutePath = path.resolve(relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

function hasAll(values, required) {
  const set = new Set(Array.isArray(values) ? values : []);
  return required.every((item) => set.has(item));
}

function resolveRuntimeProfileForMode({ editorMode, runtime, presetSchema, modePolicy }) {
  const modeKey = String(editorMode || '').toLowerCase();
  const policyMode = POLICY_MODE_BY_EDITOR_MODE[modeKey] || 'Write';
  const requiredCommandsByMode = modePolicy?.requiredCommandsByMode || {};
  const requiredCommands = Array.isArray(requiredCommandsByMode[policyMode]) ? requiredCommandsByMode[policyMode] : [];
  const defaultPreset = normalizeString(modePolicy?.defaultProfile).toLowerCase() || 'minimal';
  const declaredPresetIds = Object.keys(presetSchema?.presets || {})
    .map((presetId) => normalizeString(presetId).toLowerCase())
    .filter(Boolean);
  const candidatePresets = [defaultPreset, ...declaredPresetIds, 'pro', 'guru', 'minimal'];

  for (const presetId of candidatePresets) {
    const runtimeProfile = RUNTIME_PROFILE_BY_PRESET[presetId];
    if (!runtimeProfile) continue;
    const profile = runtime?.profiles?.[runtimeProfile];
    if (!profile || typeof profile !== 'object') continue;
    const visible = new Set(Array.isArray(profile.visible_commands) ? profile.visible_commands : []);
    const hidden = new Set(Array.isArray(profile.hidden_commands) ? profile.hidden_commands : []);
    for (const hiddenCommand of hidden) {
      visible.delete(hiddenCommand);
    }
    const requiredSatisfied = requiredCommands.every((commandId) => visible.has(commandId));
    if (requiredSatisfied) {
      return {
        runtimeProfile,
        policyMode,
        requiredCommands,
      };
    }
  }

  return {
    runtimeProfile: FALLBACK_RUNTIME_PROFILE_BY_EDITOR_MODE[modeKey] || 'LEGACY_MINIMAL',
    policyMode,
    requiredCommands,
  };
}

function evaluateY4RendererLiveWiringState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const presetSchema = readJson(X15_PRESET_SCHEMA_PATH);
    const modePolicy = readJson(X15_MODE_POLICY_PATH);
    const editorSource = readText(EDITOR_SOURCE_PATH);
    const editorBundle = readText(EDITOR_BUNDLE_PATH);

    const bootstrap = createRepoGroundedDesignOsBrowserRuntime({
      productTruth: {
        project_id: 'y4-runtime-state-check',
        scenes: { s1: 'renderer-live-wiring' },
        active_scene_id: 's1',
      },
    });
    const runtime = bootstrap?.runtime;
    const compatibility = bootstrap?.compatibility;
    const phase04LockedTargets = Array.isArray(compatibility?.phase04?.locked_targets)
      ? compatibility.phase04.locked_targets
      : [];

    const sourceMarkerPresent = editorSource.includes(Y4_MARKER);
    const sourceBootstrapPresent = editorSource.includes('createRepoGroundedDesignOsBrowserRuntime');
    const sourceApplyFnPresent = editorSource.includes('applyDesignOsRuntimeWiring');
    const bundleMarkerPresent = editorBundle.includes(Y4_MARKER);
    const runtimeBootstrapped = Boolean(runtime);
    const phase04LiveThroughRuntime = hasAll(phase04LockedTargets, REQUIRED_PHASE04_LOCKED_TARGETS);

    const modeChecks = {};
    let modeChecksGreen = true;
    const editorModes = ['write', 'plan', 'review'];
    for (const editorMode of editorModes) {
      const shellMode = SHELL_MODE_BY_EDITOR_MODE[editorMode];
      const viewportWidth = editorMode === 'plan' ? 1280 : 1440;
      const runtimeProfileSelection = resolveRuntimeProfileForMode({
        editorMode,
        runtime,
        presetSchema,
        modePolicy,
      });
      const layoutPatch = buildLayoutPatchFromSpatialState(
        {
          leftSidebarWidth: editorMode === 'plan' ? 260 : 290,
          rightSidebarWidth: editorMode === 'plan' ? 290 : 340,
        },
        {
          viewportWidth,
          viewportHeight: 900,
          shellMode,
        },
      );
      const context = {
        shell_mode: shellMode,
        profile: runtimeProfileSelection.runtimeProfile,
        workspace: mapEditorModeToWorkspace(editorMode),
        platform: 'macos',
        accessibility: 'default',
      };
      const preview = runtime.preview(context, { layout_patch: layoutPatch });
      const availableCommands = new Set(Array.isArray(preview.available_commands) ? preview.available_commands : []);
      const requiredCommandsCovered = runtimeProfileSelection.requiredCommands.every((commandId) => availableCommands.has(commandId));
      modeChecks[editorMode] = {
        policyMode: runtimeProfileSelection.policyMode,
        runtimeProfile: runtimeProfileSelection.runtimeProfile,
        requiredCommands: runtimeProfileSelection.requiredCommands,
        requiredCommandsCovered,
        availableCommandCount: availableCommands.size,
      };
      if (!requiredCommandsCovered) {
        modeChecksGreen = false;
      }
    }

    const x15PolicyLiveThroughRuntime = modeChecksGreen;
    const runtimeEntrypointBundleValidated = sourceMarkerPresent
      && sourceBootstrapPresent
      && sourceApplyFnPresent
      && bundleMarkerPresent;

    const checkStatusById = {
      RUNTIME_BOOTSTRAP_READY: asCheck(runtimeBootstrapped ? 'GREEN' : 'OPEN_GAP', true, runtimeBootstrapped ? 'RUNTIME_BOOTSTRAP_READY' : 'RUNTIME_BOOTSTRAP_FAILED'),
      PHASE04_LIVE_THROUGH_RUNTIME: asCheck(phase04LiveThroughRuntime ? 'GREEN' : 'OPEN_GAP', true, phase04LiveThroughRuntime ? 'PHASE04_LIVE_THROUGH_RUNTIME' : 'PHASE04_RUNTIME_GAP'),
      X15_POLICY_LIVE_THROUGH_RUNTIME: asCheck(x15PolicyLiveThroughRuntime ? 'GREEN' : 'OPEN_GAP', true, x15PolicyLiveThroughRuntime ? 'X15_POLICY_LIVE_THROUGH_RUNTIME' : 'X15_POLICY_RUNTIME_GAP'),
      EDITOR_SOURCE_RUNTIME_WIRING_PRESENT: asCheck(sourceMarkerPresent && sourceBootstrapPresent && sourceApplyFnPresent ? 'GREEN' : 'OPEN_GAP', true, sourceMarkerPresent && sourceBootstrapPresent && sourceApplyFnPresent ? 'EDITOR_SOURCE_RUNTIME_WIRING_PRESENT' : 'EDITOR_SOURCE_RUNTIME_WIRING_MISSING'),
      EDITOR_BUNDLE_RUNTIME_WIRING_PRESENT: asCheck(bundleMarkerPresent ? 'GREEN' : 'OPEN_GAP', true, bundleMarkerPresent ? 'EDITOR_BUNDLE_RUNTIME_WIRING_PRESENT' : 'EDITOR_BUNDLE_RUNTIME_WIRING_MISSING'),
      RUNTIME_ENTRYPOINT_BUNDLE_VALIDATED: asCheck(runtimeEntrypointBundleValidated ? 'GREEN' : 'OPEN_GAP', true, runtimeEntrypointBundleValidated ? 'RUNTIME_ENTRYPOINT_BUNDLE_VALIDATED' : 'RUNTIME_ENTRYPOINT_BUNDLE_NOT_VALIDATED'),
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([id]) => id);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([id]) => id);

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        y4RendererLiveWiringStatus: 'HOLD',
        phase04LiveThroughRuntime,
        x15PolicyLiveThroughRuntime,
        runtimeEntrypointBundleValidated,
        modeChecks,
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        taskId: TASK_ID,
        singleNextMove: 'CONTOUR_Y6_COMMAND_SEAM_FENCING',
        singleNextMoveReason: 'Y4_RUNTIME_WIRING_ESTABLISHED',
      };
    }

    const overallPass = openGapIds.length === 0;
    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      y4RendererLiveWiringStatus: overallPass ? 'PASS' : 'HOLD',
      phase04LiveThroughRuntime,
      x15PolicyLiveThroughRuntime,
      runtimeEntrypointBundleValidated,
      modeChecks,
      greenCheckIds,
      openGapIds,
      checkStatusById,
      taskId: TASK_ID,
      singleNextMove: 'CONTOUR_Y6_COMMAND_SEAM_FENCING',
      singleNextMoveReason: overallPass
        ? 'Y4_COMPLETE_NO_SCOPE_DRIFT'
        : 'Y4_RUNTIME_WIRING_GAPS_REMAIN',
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      y4RendererLiveWiringStatus: 'UNKNOWN',
      phase04LiveThroughRuntime: false,
      x15PolicyLiveThroughRuntime: false,
      runtimeEntrypointBundleValidated: false,
      modeChecks: {},
      greenCheckIds: [],
      openGapIds: ['Y4_RUNTIME_WIRING_EVALUATION_ERROR'],
      checkStatusById: {},
      taskId: TASK_ID,
      singleNextMove: 'CONTOUR_Y6_COMMAND_SEAM_FENCING',
      singleNextMoveReason: 'Y4_EVALUATION_ERROR',
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateY4RendererLiveWiringState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`Y4_RENDERER_LIVE_WIRING_OK=${state.ok ? 1 : 0}`);
    console.log(`Y4_RENDERER_LIVE_WIRING_STATUS=${state.y4RendererLiveWiringStatus}`);
    console.log(`Y4_RENDERER_LIVE_WIRING_OPEN_GAP_IDS=${(state.openGapIds || []).join(',')}`);
    console.log(`Y4_RENDERER_LIVE_WIRING_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluateY4RendererLiveWiringState };
