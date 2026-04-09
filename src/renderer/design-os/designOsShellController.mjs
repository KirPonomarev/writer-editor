export const DESIGN_OS_PROFILE_OPTIONS = Object.freeze([
  'BASELINE',
  'FOCUS',
  'COMPACT',
  'SAFE',
]);

export const DESIGN_OS_SHELL_MODE_OPTIONS = Object.freeze([
  'CALM_DOCKED',
  'COMPACT_DOCKED',
  'SPATIAL_ADVANCED',
  'SAFE_RECOVERY',
]);

export const DESIGN_OS_WORKSPACE_BY_EDITOR_MODE = Object.freeze({
  write: 'WRITE',
  plan: 'PLAN',
  review: 'REVIEW',
});

const RAIL_WIDTH_CONFIG_BY_MODE = Object.freeze({
  desktop: Object.freeze({
    leftMin: 280,
    leftMax: 420,
    leftBaseline: 290,
    rightMin: 280,
    rightMax: 420,
    rightBaseline: 290,
  }),
  compact: Object.freeze({
    leftMin: 250,
    leftMax: 320,
    leftBaseline: 260,
    rightMin: 250,
    rightMax: 320,
    rightBaseline: 260,
  }),
  mobile: Object.freeze({
    leftMin: 200,
    leftMax: 240,
    leftBaseline: 240,
    rightMin: 200,
    rightMax: 240,
    rightBaseline: 240,
    rightVisible: false,
  }),
});

function clampInt(value, min, max, fallback) {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : Math.trunc(fallback);
  return Math.max(min, Math.min(max, numeric));
}

function withAlpha(hexColor, alphaHex) {
  if (typeof hexColor !== 'string') return '';
  const cleaned = hexColor.trim();
  if (!/^#[0-9a-fA-F]{6}$/u.test(cleaned)) return cleaned;
  return `${cleaned}${alphaHex}`;
}

function getRailWidthConfig(mode) {
  if (mode === 'compact') return RAIL_WIDTH_CONFIG_BY_MODE.compact;
  if (mode === 'mobile') return RAIL_WIDTH_CONFIG_BY_MODE.mobile;
  return RAIL_WIDTH_CONFIG_BY_MODE.desktop;
}

function resolveRailWidthCandidate(source, keys, min, max, baseline) {
  const candidates = Array.isArray(keys)
    ? keys.map((key) => source?.[key])
    : [];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= min && numeric <= max) {
      return clampInt(numeric, min, max, baseline);
    }
  }

  return baseline;
}

export function deriveRuntimePlatformId() {
  const platform = typeof navigator?.platform === 'string' ? navigator.platform.toLowerCase() : '';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux')) return 'linux';
  const userAgent = typeof navigator?.userAgent === 'string' ? navigator.userAgent.toLowerCase() : '';
  if (userAgent.includes('android')) return 'android';
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
  return 'web';
}

export function deriveAccessibilityId() {
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'reduced_motion';
    }
  } catch {}
  return 'default';
}

export function mapEditorModeToWorkspace(mode) {
  return DESIGN_OS_WORKSPACE_BY_EDITOR_MODE[String(mode || '').toLowerCase()] || 'WRITE';
}

export function buildLayoutPatchFromSpatialState(state, options = {}) {
  const source = state && typeof state === 'object' ? state : {};
  const viewportWidth = clampInt(options.viewportWidth, 320, 4096, 1440);
  const viewportHeight = clampInt(options.viewportHeight, 320, 4096, 900);
  const shellMode = typeof options.shellMode === 'string' && options.shellMode.trim()
    ? options.shellMode.trim()
    : 'CALM_DOCKED';
  const config = getRailWidthConfig(shellMode === 'COMPACT_DOCKED' ? 'compact' : 'desktop');
  const rightVisible = options.rightVisible !== false && config.rightVisible !== false;
  const leftWidth = resolveRailWidthCandidate(
    source,
    ['leftSidebarWidth', 'left_width'],
    config.leftMin,
    config.leftMax,
    config.leftBaseline
  );
  const rightWidth = resolveRailWidthCandidate(
    source,
    ['rightSidebarWidth', 'right_width'],
    config.rightMin,
    config.rightMax,
    config.rightBaseline
  );
  return {
    left_width: leftWidth,
    right_width: rightVisible ? rightWidth : config.rightBaseline,
    bottom_height: 96,
    editor_root: 'docked',
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    shell_mode: shellMode,
  };
}

export function buildSpatialStateFromLayoutSnapshot(layout, options = {}) {
  const viewportWidth = clampInt(layout?.viewport_width, 320, 4096, options.viewportWidth || 1440);
  const viewportMode = typeof options.viewportMode === 'string' && options.viewportMode.trim()
    ? options.viewportMode.trim()
    : viewportWidth <= 900 ? 'mobile' : viewportWidth <= 1280 ? 'compact' : 'desktop';
  const config = getRailWidthConfig(viewportMode);
  const rightVisible = options.rightVisible !== false && config.rightVisible !== false;
  const leftWidth = resolveRailWidthCandidate(
    layout,
    ['leftSidebarWidth', 'left_width'],
    config.leftMin,
    config.leftMax,
    config.leftBaseline
  );
  const rightWidth = resolveRailWidthCandidate(
    layout,
    ['rightSidebarWidth', 'right_width'],
    config.rightMin,
    config.rightMax,
    config.rightBaseline
  );
  return {
    leftSidebarWidth: leftWidth,
    rightSidebarWidth: rightVisible ? rightWidth : config.rightBaseline,
    viewportWidth,
    viewportMode,
    source: 'design-os-runtime',
  };
}

export function extractCssVariablesFromTokens(tokens, options = {}) {
  const isDarkTheme = options.isDarkTheme === true;
  const vars = {};
  if (!isDarkTheme) {
    vars['--background'] = tokens?.color?.background?.canvas || '#f7f6f3';
    vars['--foreground'] = tokens?.color?.text?.primary || '#1d1b19';
    vars['--card'] = tokens?.color?.surface?.panel || '#ffffff';
    vars['--card-foreground'] = tokens?.color?.text?.primary || '#1d1b19';
    vars['--canvas-bg'] = tokens?.surface?.shell?.background || tokens?.color?.background?.canvas || '#f7f6f3';
    vars['--sidebar'] = tokens?.color?.surface?.elevated || tokens?.color?.surface?.panel || '#f0ede8';
    vars['--sidebar-foreground'] = tokens?.color?.text?.primary || '#1d1b19';
    vars['--sidebar-border'] = withAlpha(tokens?.color?.border?.strong || '#b4ab9f', '44');
    vars['--status-bg'] = withAlpha(tokens?.color?.surface?.panel || '#ffffff', 'D9');
  }
  vars['--toolbar-chip-bg'] = tokens?.semanticIntent?.brand || '#2f6fed';
  vars['--toolbar-chip-text'] = tokens?.color?.text?.inverse || '#ffffff';
  vars['--selected-bg'] = withAlpha(tokens?.semanticIntent?.brand || '#2f6fed', '24');
  vars['--hover-bg'] = withAlpha(tokens?.semanticIntent?.brand || '#2f6fed', '16');
  vars['--toolbar-border'] = withAlpha(tokens?.color?.border?.strong || '#b4ab9f', '33');
  vars['--toolbar-divider'] = withAlpha(tokens?.color?.border?.subtle || '#d8d1c8', '44');
  vars['--toolbar-control-border'] = withAlpha(tokens?.color?.border?.strong || '#b4ab9f', '55');
  vars['--tree-line-color'] = withAlpha(tokens?.color?.border?.subtle || '#d8d1c8', '55');
  vars['--radius'] = `${Number(tokens?.radius?.sm || 4) / 16}rem`;
  const densityScale = Number(tokens?.density?.[tokens?.density?.active || 'default']?.scale || tokens?.density?.default?.scale || 1);
  vars['--tree-row-height'] = `${Math.round(32 * densityScale)}px`;
  return vars;
}

export function applyCssVariables(root, vars) {
  if (!root || !vars || typeof vars !== 'object') return;
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    root.style.setProperty(key, String(value));
  }
}

export function buildDesignOsStatusText(input = {}) {
  const profile = input.profile || 'BASELINE';
  const shellMode = input.shellMode || 'CALM_DOCKED';
  const workspace = input.workspace || 'WRITE';
  const degraded = input.degraded === true ? ' degraded' : '';
  return `YDOS ${profile} / ${shellMode} / ${workspace}${degraded}`;
}
