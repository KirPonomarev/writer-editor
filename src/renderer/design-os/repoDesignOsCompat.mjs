import {
  createDesignOsRuntime,
  createLayoutSnapshot,
  deepCopyTree,
} from './designOsRuntime.mjs';

const DEFAULT_RUNTIME_TO_CAPABILITY_PLATFORM = Object.freeze({
  macos: 'node',
  windows: 'node',
  linux: 'node',
  web: 'web',
  android: 'mobile-wrapper',
  ios: 'mobile-wrapper',
});

const PHASE04_REQUIRED_TARGETS_LEGACY = Object.freeze([
  'DESIGN_LAYER_BASELINE',
  'BASELINE_SAFE_FOCUS_COMPACT',
  'VISIBLE_DESIGN_SWITCH',
  'DOCUMENT_TRUTH_UNCHANGED',
  'RECOVERY_TRUTH_UNCHANGED',
  'COMMAND_SEMANTICS_UNCHANGED',
]);

const PHASE04_REQUIRED_TARGETS_CURRENT = Object.freeze([
  'DESIGN_LAYER_BASELINE',
  'TOKENS',
  'TYPOGRAPHY',
  'SKINS',
  'SUPPORTED_MODES',
  'TEXT_TRUTH_UNTOUCHED',
  'RECOVERY_TRUTH_UNTOUCHED',
  'COMMAND_SEMANTICS_UNTOUCHED',
  'NO_SHELL_OR_SPATIAL_RUNTIME_CLOSURE_CLAIM',
]);

const PHASE05_REQUIRED_TARGETS = Object.freeze([
  'BOUNDED_SPATIAL_SHELL',
  'MOVABLE_SIDE_CONTAINERS',
  'SAFE_RESTORE_AND_LAYOUT_RECOVERY',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOTS',
  'EDITOR_ROOT_FIXED_DOCKED',
]);

const CURRENT_SHELL_MODES = Object.freeze([
  'CALM_DOCKED',
  'COMPACT_DOCKED',
  'SPATIAL_ADVANCED',
  'SAFE_RECOVERY',
]);

const CURRENT_PROFILE_IDS = Object.freeze([
  'BASELINE',
  'FOCUS',
  'COMPACT',
  'SAFE',
  'LEGACY_MINIMAL',
  'LEGACY_PRO',
  'LEGACY_GURU',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stableCompare(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function uniqueSortedStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((entry) => normalizeString(entry)).filter(Boolean))].sort(stableCompare);
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function setHasAll(set, values) {
  return Array.isArray(values) && values.every((value) => set.has(value));
}

function listPresetCommands(schema) {
  const presets = isPlainObject(schema?.presets) ? schema.presets : {};
  const out = [];
  for (const presetId of Object.keys(presets)) {
    const commandVisibility = isPlainObject(presets[presetId]?.commandVisibility) ? presets[presetId].commandVisibility : {};
    out.push(...(Array.isArray(commandVisibility.forceVisible) ? commandVisibility.forceVisible : []));
    out.push(...(Array.isArray(commandVisibility.hidden) ? commandVisibility.hidden : []));
  }
  return uniqueSortedStrings(out);
}

export function mapRuntimePlatformToCapabilityPlatform(runtimePlatform, platformMap = DEFAULT_RUNTIME_TO_CAPABILITY_PLATFORM) {
  const platformId = normalizeString(runtimePlatform);
  if (!platformId) return 'node';
  return normalizeString(platformMap[platformId]) || platformId;
}

export function adaptRepoThemeConfig(raw) {
  const source = isPlainObject(raw) ? raw : {};
  ensure(isPlainObject(source.colors), 'Repo theme config is missing colors.');
  ensure(isPlainObject(source.typography), 'Repo theme config is missing typography.');
  ensure(isPlainObject(source.spacing), 'Repo theme config is missing spacing.');
  ensure(isPlainObject(source.radius), 'Repo theme config is missing radius.');
  ensure(isPlainObject(source.animations), 'Repo theme config is missing animations.');
  return {
    schemaVersion: 1,
    baselineId: 'repo.theme.v1',
    color: {
      background: { canvas: source.colors.surface.canvas },
      surface: {
        panel: source.colors.surface.panel,
        elevated: source.colors.surface.elevated,
      },
      text: {
        primary: source.colors.text.primary,
        secondary: source.colors.text.muted,
        inverse: source.colors.text.inverse,
      },
      accent: deepCopyTree(source.colors.accent),
      border: deepCopyTree(source.colors.border),
    },
    typography: {
      font: {
        body: {
          family: source.typography.fontFamilies.editor,
          sizePx: source.typography.fontSizes.md,
        },
        ui: {
          family: source.typography.fontFamilies.ui,
          sizePx: source.typography.fontSizes.sm,
        },
        mono: {
          family: source.typography.fontFamilies.mono,
          sizePx: source.typography.fontSizes.sm,
        },
      },
      scale: {
        body: { lineHeight: source.typography.lineHeights.normal },
        tight: source.typography.lineHeights.tight,
        relaxed: source.typography.lineHeights.relaxed,
      },
      weight: deepCopyTree(source.typography.fontWeights),
    },
    spacing: {
      base: source.spacing.unit,
      scale: deepCopyTree(source.spacing.scale),
    },
    radius: deepCopyTree(source.radius),
    motion: {
      enabled: true,
      duration: deepCopyTree(source.animations.duration),
      easing: deepCopyTree(source.animations.easing),
      reduced: deepCopyTree(source.animations.reducedMotion),
    },
    focus: {
      ring: {
        color: source.colors.accent.brand,
        width: 2,
      },
    },
    density: {
      default: { scale: 1 },
      compact: { scale: 0.9 },
      focus: { scale: 0.85 },
    },
    surface: {
      editor: { background: source.colors.surface.panel },
      shell: { background: source.colors.surface.canvas },
    },
    semanticIntent: {
      danger: source.colors.accent.danger,
      success: source.colors.accent.success,
      brand: source.colors.accent.brand,
    },
  };
}

export function validatePresetSchemaAgainstCatalog(schema, knownCommandIds) {
  const known = new Set(uniqueSortedStrings(knownCommandIds));
  const referenced = uniqueSortedStrings([
    ...(Array.isArray(schema?.requiredCoreCommands) ? schema.requiredCoreCommands : []),
    ...listPresetCommands(schema),
  ]);
  const unknown = referenced.filter((commandId) => !known.has(commandId));
  if (unknown.length > 0) {
    throw new Error(`Preset schema references unknown commands: ${unknown.join(', ')}`);
  }
}

export function derivePhase04Compatibility(phase04) {
  const packet = isPlainObject(phase04) ? phase04 : {};
  const lockedTargets = new Set(uniqueSortedStrings(packet.lockedTargetIds));
  const hasLegacyTargets = setHasAll(lockedTargets, PHASE04_REQUIRED_TARGETS_LEGACY);
  const hasCurrentTargets = setHasAll(lockedTargets, PHASE04_REQUIRED_TARGETS_CURRENT);
  ensure(hasLegacyTargets || hasCurrentTargets, 'Phase04 packet missing required locked targets for known schema variants.');

  const ownershipLockedLegacy = packet.proof?.phase04DocumentTruthUnchangedTrue === true
    && packet.proof?.phase04RecoveryTruthUnchangedTrue === true
    && packet.proof?.phase04CommandSemanticsUnchangedTrue === true;
  const ownershipLockedCurrent = packet.scope?.designLayerOnly === true
    && packet.scope?.touchesDocumentTruth === false
    && packet.scope?.touchesRecoveryTruth === false
    && packet.scope?.touchesCommandSemantics === false
    && packet.scope?.shellRuntimeClosureClaimed === false
    && packet.scope?.spatialRuntimeClosureClaimed === false;
  ensure(ownershipLockedLegacy || ownershipLockedCurrent, 'Phase04 packet no longer proves ownership boundaries are locked.');

  const antiFalseGreen = packet.proof?.noFalsePhase04GreenTrue === true
    || packet.proof?.noFalsePhase04DesignBaselineGreenTrue === true;
  ensure(antiFalseGreen, 'Phase04 packet no longer proves anti-false-green baseline.');

  const baselineSafeFocusCompact = packet.proof?.phase04BaselineSafeFocusCompactTrue === true
    || (
      Array.isArray(packet.profileIds)
      && ['BASELINE', 'SAFE', 'FOCUS', 'COMPACT'].every((profileId) => packet.profileIds.includes(profileId))
    );
  const visibleDesignSwitch = packet.proof?.phase04VisibleDesignSwitchTrue === true
    || Array.isArray(packet.designLayerSurfaceIds) && packet.designLayerSurfaceIds.includes('SUPPORTED_MODES');

  return {
    shell_modes: [...CURRENT_SHELL_MODES],
    profile_ids: [...CURRENT_PROFILE_IDS],
    locked_targets: [...lockedTargets],
    evidence: {
      baseline_safe_focus_compact: baselineSafeFocusCompact,
      visible_design_switch: visibleDesignSwitch,
      ownership_locked: ownershipLockedLegacy || ownershipLockedCurrent,
    },
  };
}

export function derivePhase05Compatibility(phase05, safeResetArtifact) {
  const packet = isPlainObject(phase05) ? phase05 : {};
  const recovery = isPlainObject(safeResetArtifact) ? safeResetArtifact : {};
  const lockedTargets = new Set(uniqueSortedStrings(packet.lockedTargetIds));
  for (const targetId of PHASE05_REQUIRED_TARGETS) {
    ensure(lockedTargets.has(targetId), `Phase05 packet missing locked target: ${targetId}`);
  }
  ensure(packet.proof?.phase05LayoutRecoveryLastStableBaselinePassTrue === true, 'Phase05 packet no longer proves last-stable layout recovery.');
  ensure(packet.proof?.phase05InvalidLayoutAndMissingMonitorRecoveryBaselinePassTrue === true, 'Phase05 packet no longer proves invalid layout recovery.');
  ensure(packet.proof?.noFalsePhase05GreenTrue === true, 'Phase05 packet no longer proves anti-false-green baseline.');
  ensure(recovery.proof?.shellLevelSafeResetPresentTrue === true, 'Phase03 safe reset artifact no longer proves shell level safe reset.');
  ensure(recovery.proof?.lastStableRestorePresentTrue === true, 'Phase03 safe reset artifact no longer proves last stable restore.');

  return {
    bounded_shell: true,
    safe_reset: true,
    restore_last_stable: true,
    invalid_layout_fallback: true,
    editor_root_fixed_docked: lockedTargets.has('EDITOR_ROOT_FIXED_DOCKED'),
    baseline_layout: createLayoutSnapshot({
      left_width: 290,
      right_width: 340,
      bottom_height: 96,
      editor_root: 'docked',
      viewport_width: 1440,
      viewport_height: 900,
      shell_mode: 'CALM_DOCKED',
    }),
    compact_layout: createLayoutSnapshot({
      left_width: 260,
      right_width: 290,
      bottom_height: 96,
      editor_root: 'docked',
      viewport_width: 1280,
      viewport_height: 900,
      shell_mode: 'COMPACT_DOCKED',
    }),
    safe_layout: createLayoutSnapshot({
      left_width: 290,
      right_width: 340,
      bottom_height: 96,
      editor_root: 'docked',
      viewport_width: 1440,
      viewport_height: 900,
      shell_mode: 'SAFE_RECOVERY',
    }),
    mobile_left_width: 240,
    evidence: {
      last_stable: packet.proof?.phase05LayoutRecoveryLastStableBaselinePassTrue === true,
      invalid_layout: packet.proof?.phase05InvalidLayoutAndMissingMonitorRecoveryBaselinePassTrue === true,
      safe_reset: recovery.proof?.shellLevelSafeResetPresentTrue === true,
      restore_last_stable: recovery.proof?.lastStableRestorePresentTrue === true,
    },
  };
}

export function buildRuntimeProfiles(legacySchema, options = {}) {
  const schema = isPlainObject(legacySchema) ? legacySchema : {};
  const presets = isPlainObject(schema.presets) ? schema.presets : {};
  const knownCommands = new Set(uniqueSortedStrings(options.knownCommandIds || []));
  const requiredCoreCommands = uniqueSortedStrings(schema.requiredCoreCommands);

  const sanitizeVisible = (value) => {
    const visible = uniqueSortedStrings(value);
    const merged = uniqueSortedStrings([...visible, ...requiredCoreCommands]);
    if (knownCommands.size === 0) return merged;
    return merged.filter((commandId) => knownCommands.has(commandId));
  };

  const sanitizeHidden = (value) => {
    const hidden = uniqueSortedStrings(value).filter((commandId) => !requiredCoreCommands.includes(commandId));
    if (knownCommands.size === 0) return hidden;
    return hidden.filter((commandId) => knownCommands.has(commandId));
  };

  const minimal = isPlainObject(presets.minimal) ? presets.minimal : {};
  const pro = isPlainObject(presets.pro) ? presets.pro : {};
  const guru = isPlainObject(presets.guru) ? presets.guru : {};

  const minimalVisibility = isPlainObject(minimal.commandVisibility) ? minimal.commandVisibility : {};
  const proVisibility = isPlainObject(pro.commandVisibility) ? pro.commandVisibility : {};
  const guruVisibility = isPlainObject(guru.commandVisibility) ? guru.commandVisibility : {};

  const baselineVisible = sanitizeVisible(proVisibility.forceVisible);
  const baselineHidden = sanitizeHidden(proVisibility.hidden);
  const focusVisible = sanitizeVisible(minimalVisibility.forceVisible);
  const focusHidden = sanitizeHidden([
    ...(Array.isArray(minimalVisibility.hidden) ? minimalVisibility.hidden : []),
    'cmd.project.exportMarkdownV1',
    'cmd.project.flowSaveV1',
  ]);
  const compactHidden = sanitizeHidden([
    ...baselineHidden,
    'cmd.project.flowOpenV1',
    'cmd.project.flowSaveV1',
  ]);

  return {
    BASELINE: {
      profile_id: 'BASELINE',
      visible_commands: baselineVisible,
      hidden_commands: baselineHidden,
      density_scale: 1,
    },
    FOCUS: {
      profile_id: 'FOCUS',
      visible_commands: focusVisible,
      hidden_commands: focusHidden,
      density_scale: 0.85,
    },
    COMPACT: {
      profile_id: 'COMPACT',
      visible_commands: baselineVisible,
      hidden_commands: compactHidden,
      density_scale: 0.9,
    },
    SAFE: {
      profile_id: 'SAFE',
      visible_commands: baselineVisible,
      hidden_commands: baselineHidden,
      density_scale: 1,
    },
    LEGACY_MINIMAL: {
      profile_id: 'LEGACY_MINIMAL',
      visible_commands: focusVisible,
      hidden_commands: focusHidden,
      density_scale: 0.85,
    },
    LEGACY_PRO: {
      profile_id: 'LEGACY_PRO',
      visible_commands: baselineVisible,
      hidden_commands: baselineHidden,
      density_scale: 1,
    },
    LEGACY_GURU: {
      profile_id: 'LEGACY_GURU',
      visible_commands: sanitizeVisible(guruVisibility.forceVisible),
      hidden_commands: sanitizeHidden(guruVisibility.hidden),
      density_scale: 1,
    },
  };
}

export function buildWorkspaceManifests(shellPolicy) {
  const policy = isPlainObject(shellPolicy) ? shellPolicy : {};
  const requiredPanels = isPlainObject(policy.requiredPanelsByMode) ? policy.requiredPanelsByMode : {};
  return {
    WRITE: {
      workspace_id: 'WRITE',
      panels: Array.isArray(requiredPanels.Write) ? [...requiredPanels.Write] : ['projectTree', 'editor', 'inspector', 'statusBar'],
    },
    PLAN: {
      workspace_id: 'PLAN',
      panels: Array.isArray(requiredPanels.Plan) ? [...requiredPanels.Plan] : ['projectTree', 'editor', 'timeline', 'statusBar'],
    },
    REVIEW: {
      workspace_id: 'REVIEW',
      panels: Array.isArray(requiredPanels.Review) ? [...requiredPanels.Review] : ['projectTree', 'editor', 'review', 'statusBar'],
    },
  };
}

export function buildCommandKernel(commandCatalogRows, capabilityPolicy, options = {}) {
  const rows = Array.isArray(commandCatalogRows) ? commandCatalogRows : [];
  const explicitCapabilityMap = isPlainObject(options.capabilities) ? options.capabilities : {};
  const platformMap = isPlainObject(options.platformCapabilityMap)
    ? { ...DEFAULT_RUNTIME_TO_CAPABILITY_PLATFORM, ...options.platformCapabilityMap }
    : DEFAULT_RUNTIME_TO_CAPABILITY_PLATFORM;
  const catalog = {};
  for (const row of rows) {
    if (!isPlainObject(row) || !normalizeString(row.id)) continue;
    catalog[row.id] = {
      key: row.key,
      id: row.id,
      label: row.label,
      group: row.group,
      surface: Array.isArray(row.surface) ? [...row.surface] : [],
      hotkey: row.hotkey,
    };
  }

  const defaultCapabilities = {};
  for (const commandId of Object.keys(catalog)) {
    const group = normalizeString(catalog[commandId].group);
    defaultCapabilities[commandId] = !group.startsWith('flow');
  }

  return {
    catalog,
    capabilities: defaultCapabilities,
    platformCapabilityMap: { ...platformMap },
    isAvailable(commandId, ctx = {}) {
      if (Object.prototype.hasOwnProperty.call(explicitCapabilityMap, commandId)) {
        return Boolean(explicitCapabilityMap[commandId]);
      }
      if (typeof capabilityPolicy?.enforceCapabilityForCommand === 'function') {
        const runtimePlatform = normalizeString(ctx.platform) || 'macos';
        const capabilityPlatform = mapRuntimePlatformToCapabilityPlatform(runtimePlatform, platformMap);
        const verdict = capabilityPolicy.enforceCapabilityForCommand(commandId, { platformId: capabilityPlatform }, { platformId: capabilityPlatform });
        return verdict?.ok === true;
      }
      return Boolean(defaultCapabilities[commandId]);
    },
    listKnownCommands() {
      return Object.keys(catalog);
    },
  };
}

export function buildRuntimeState(repoTheme, options = {}) {
  const phase05 = isPlainObject(options.phase05Compatibility) ? options.phase05Compatibility : {};
  const baseTokens = adaptRepoThemeConfig(repoTheme);
  const baselineLayout = createLayoutSnapshot(phase05.baseline_layout || {
    left_width: 290,
    right_width: 340,
    bottom_height: 96,
    editor_root: 'docked',
    viewport_width: 1440,
    viewport_height: 900,
    shell_mode: 'CALM_DOCKED',
  });

  return {
    base_tokens: baseTokens,
    mode_overrides: {
      CALM_DOCKED: { motion: { enabled: true }, density: { active: 'default' } },
      COMPACT_DOCKED: { density: { active: 'compact' } },
      SPATIAL_ADVANCED: { surface: { shell: { allowsFloatingPanels: true } } },
      SAFE_RECOVERY: { motion: { enabled: false }, surface: { shell: { safetyBanner: true } } },
    },
    profile_overrides: {
      BASELINE: { density: { active: 'default' } },
      FOCUS: { density: { active: 'focus' } },
      COMPACT: { density: { active: 'compact' } },
      SAFE: { motion: { enabled: false }, focus: { ring: { width: 3 } } },
      LEGACY_MINIMAL: { density: { active: 'focus' } },
      LEGACY_PRO: { density: { active: 'default' } },
      LEGACY_GURU: { density: { active: 'default' } },
    },
    workspace_overrides: {
      WRITE: { surface: { workspace: { emphasis: 'text' } } },
      PLAN: { surface: { workspace: { emphasis: 'structure' } } },
      REVIEW: { surface: { workspace: { emphasis: 'review' } } },
    },
    platform_overrides: {
      macos: { surface: { platform: { titlebarHeight: 22 } }, typography: { platformLabel: 'macos' } },
      windows: { surface: { platform: { titlebarHeight: 26 } }, typography: { platformLabel: 'windows' } },
      linux: { surface: { platform: { titlebarHeight: 24 } }, typography: { platformLabel: 'linux' } },
      web: { surface: { platform: { titlebarHeight: 0 } }, typography: { platformLabel: 'web' } },
      android: { surface: { platform: { titlebarHeight: 0 } }, density: { active: 'compact' } },
      ios: { surface: { platform: { titlebarHeight: 0 } }, density: { active: 'compact' } },
    },
    accessibility_overrides: {
      default: {},
      reduced_motion: { motion: { enabled: false, reduced: { duration: 0 } } },
      high_contrast: { focus: { ring: { width: 4 } }, color: { border: { strong: '#000000' } } },
    },
    runtime_fallback: {
      focus: { ring: { color: '#2f6fed', width: 2 } },
      surface: { editor: { background: '#ffffff' } },
      color: { border: { strong: '#b4ab9f' } },
    },
    design_state: {},
    baseline_layout: baselineLayout,
    current_layout: baselineLayout,
    last_stable_layout: baselineLayout,
  };
}

export function buildRuntimeBootstrap(input = {}) {
  const repoTheme = input.repoTheme;
  const presetSchema = input.presetSchema;
  const shellPolicy = input.shellPolicy;
  const commandCatalogRows = Array.isArray(input.commandCatalogRows) ? input.commandCatalogRows : [];
  const capabilityPolicy = input.capabilityPolicy;
  const phase04Compatibility = derivePhase04Compatibility(input.phase04);
  const phase05Compatibility = derivePhase05Compatibility(input.phase05, input.safeResetArtifact);
  const knownCommandIds = commandCatalogRows.map((entry) => entry.id);

  validatePresetSchemaAgainstCatalog(presetSchema, knownCommandIds);

  const profiles = buildRuntimeProfiles(presetSchema, { knownCommandIds });
  const workspaces = buildWorkspaceManifests(shellPolicy);
  const runtimeState = buildRuntimeState(repoTheme, { phase05Compatibility });

  return {
    runtime: createDesignOsRuntime({
      productTruth: isPlainObject(input.productTruth) ? input.productTruth : {
        project_id: 'repo-current-workspace',
        scenes: {
          s1: 'The text truth must survive design changes.',
        },
        active_scene_id: 's1',
      },
      commandKernel: buildCommandKernel(commandCatalogRows, capabilityPolicy, {
        capabilities: input.capabilities,
        platformCapabilityMap: input.platformCapabilityMap,
      }),
      runtimeState,
      profiles,
      workspaces,
      supportedContext: {
        shell_modes: [...phase04Compatibility.shell_modes],
        profile_ids: Object.keys(profiles),
        workspace_ids: Object.keys(workspaces),
        platform_ids: Object.keys(runtimeState.platform_overrides),
        accessibility_ids: Object.keys(runtimeState.accessibility_overrides),
      },
    }),
    compatibility: {
      phase04: phase04Compatibility,
      phase05: phase05Compatibility,
    },
  };
}
