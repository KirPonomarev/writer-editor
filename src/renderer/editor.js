import { getTiptapPlainText, initTiptap, redoTiptap, setTiptapPlainText, setTiptapRuntimeHandlers, undoTiptap } from './tiptap/index.js';
import {
  applyCssVariables,
  buildLayoutPatchFromSpatialState,
  buildProductTruthHash,
  buildDesignOsStatusText,
  buildSpatialStateFromLayoutSnapshot,
  createDesignOsPorts,
  createRepoGroundedDesignOsBrowserRuntime,
  deriveAccessibilityId,
  deriveRuntimePlatformId,
  extractCssVariablesFromTokens,
  mapEditorModeToWorkspace,
} from './design-os/index.mjs';
import { createCommandRegistry } from './commands/registry.mjs';
import { createCommandRunner } from './commands/runCommand.mjs';
import { listCommandCatalog } from './commands/command-catalog.v1.mjs';
import {
  COMMAND_IDS,
  EXTRA_COMMAND_IDS,
  UI_COMMAND_IDS,
  registerProjectCommands,
} from './commands/projectCommands.mjs';
import { COMMAND_BUS_ROUTE, runCommandThroughBus } from './commands/commandBusGuard.mjs';
import { createPaletteDataProvider } from './commands/palette-groups.v1.mjs';
import {
  buildFlowModeKickoffStatus,
  buildFlowModeCoreStatus,
  buildFlowModeReopenBlockedStatus,
  buildFlowModeM9KickoffStatus,
  buildFlowModeM9CoreSaveErrorStatus,
  buildFlowModeM9NextNoopSaveStatus,
  buildFlowSavePayload,
  composeFlowDocument,
  nextSceneCaretAtBoundary,
  previousSceneCaretAtBoundary,
} from './commands/flowMode.mjs';
import uiErrorMapDoc from '../../docs/OPS/STATUS/UI_ERROR_MAP.json';

const isTiptapMode = window.__USE_TIPTAP === true;
const editor = document.getElementById('editor');
if (isTiptapMode) {
  initTiptap(editor, { attachIpc: false });
}
const statusElement = document.getElementById('status');
const saveStateElement = document.querySelector('[data-save-state]');
const warningStateElement = document.querySelector('[data-warning-state]');
const perfHintElement = document.querySelector('[data-perf-hint]');
const appLayout = document.querySelector('.app-layout');
const emptyState = document.querySelector('.empty-state');
const editorPanel = document.querySelector('.editor-panel');
const sidebar = document.querySelector('.sidebar');
const sidebarResizer = document.querySelector('[data-sidebar-resizer]');
const rightSidebarResizer = document.querySelector('[data-right-sidebar-resizer]');
const mainContent = document.querySelector('.main-content');
const toolbar = document.querySelector('[data-toolbar]');
const modeSwitcher = document.querySelector('[data-mode-switcher]');
const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
const leftTabsHost = document.querySelector('[data-left-tabs]');
const leftTabButtons = Array.from(document.querySelectorAll('[data-left-tab]'));
const leftSearchPanel = document.querySelector('[data-left-search-panel]');
const leftSearchInput = document.querySelector('[data-left-search-input]');
const outlineListElement = document.querySelector('[data-outline-list]');
const searchResultsElement = document.querySelector('[data-search-results]');
const rightSidebar = document.querySelector('[data-right-sidebar]');
const rightTabsHost = document.querySelector('[data-right-tabs]');
const rightTabButtons = Array.from(document.querySelectorAll('[data-right-tab]'));
const rightInspectorPanel = document.querySelector('[data-right-panel-inspector]');
const rightSceneMetaPanel = document.querySelector('[data-right-panel-scene-meta]');
const rightCommentsPanel = document.querySelector('[data-right-panel-comments]');
const rightHistoryPanel = document.querySelector('[data-right-panel-history]');
const inspectorSnapshotElement = document.querySelector('[data-inspector-snapshot]');
const wordCountElement = document.querySelector('[data-word-count]');
const zoomValueElement = document.querySelector('[data-zoom-value]');
const styleSelect = document.querySelector('[data-style-select]');
const fontSelect = document.querySelector('[data-font-select]');
const weightSelect = document.querySelector('[data-weight-select]');
const sizeSelect = document.querySelector('[data-size-select]');
const lineHeightSelect = document.querySelector('[data-line-height-select]');
const textStyleSelect = document.querySelector('[data-text-style-select]');
const themeDarkButton = document.querySelector('[data-action="theme-dark"]');
const themeLightButton = document.querySelector('[data-action="theme-light"]');
const wrapToggleButton = document.querySelector('[data-action="toggle-wrap"]');
const toolbarToggleButton = document.querySelector('[data-action="minimize"]');
const alignButtons = Array.from(document.querySelectorAll('[data-action^="align-"]'));
const treeContainer = document.querySelector('[data-tree]');
const metaPanel = document.querySelector('[data-meta-panel]');
const metaSynopsis = document.querySelector('[data-meta-synopsis]');
const metaStatus = document.querySelector('[data-meta-status]');
const metaTagPov = document.querySelector('[data-meta-tag="pov"]');
const metaTagLine = document.querySelector('[data-meta-tag="line"]');
const metaTagPlace = document.querySelector('[data-meta-tag="place"]');
const cardsList = document.querySelector('[data-cards-list]');
const addCardButton = document.querySelector('[data-action="add-card"]');
const contextMenu = document.querySelector('[data-context-menu]');
const cardModal = document.querySelector('[data-card-modal]');
const settingsModal = document.querySelector('[data-settings-modal]');
const settingsThemeSelect = document.querySelector('[data-settings-theme]');
const settingsWrapSelect = document.querySelector('[data-settings-wrap]');
const settingsCloseButtons = Array.from(document.querySelectorAll('[data-settings-close]'));
const recoveryModal = document.querySelector('[data-recovery-modal]');
const recoveryMessage = document.querySelector('[data-recovery-message]');
const recoveryCloseButtons = Array.from(document.querySelectorAll('[data-recovery-close]'));
const exportPreviewModal = document.querySelector('[data-export-preview-modal]');
const exportPreviewMessage = document.querySelector('[data-export-preview-message]');
const exportPreviewConfirmButtons = Array.from(document.querySelectorAll('[data-export-preview-confirm]'));
const exportPreviewCancelButtons = Array.from(document.querySelectorAll('[data-export-preview-cancel]'));
const diagnosticsModal = document.querySelector('[data-diagnostics-modal]');
const diagnosticsText = document.querySelector('[data-diagnostics-text]');
const diagnosticsCloseButtons = Array.from(document.querySelectorAll('[data-diagnostics-close]'));
const cardTitleInput = document.querySelector('[data-card-title]');
const cardTextInput = document.querySelector('[data-card-text]');
const cardTagsInput = document.querySelector('[data-card-tags]');
const cardSaveButtons = Array.from(document.querySelectorAll('[data-card-save]'));
const cardCancelButtons = Array.from(document.querySelectorAll('[data-card-cancel]'));
const TOOLBAR_COMPACT_CLASS = 'is-compact';
const TEXT_STYLE_DEFAULT = 'paragraph-none';
const ALIGNMENT_PREFIX_BY_ACTION = {
  'align-center': '::center:: ',
  'align-right': '::right:: ',
  'align-justify': '::justify:: ',
  'align-left': '',
};
const ALIGNMENT_MARKERS = ['::center:: ', '::right:: ', '::justify:: '];
const EDITOR_ZOOM_STORAGE_KEY = 'editorZoom';
const EDITOR_ZOOM_MIN = 0.5;
const EDITOR_ZOOM_MAX = 2.0;
const EDITOR_ZOOM_STEP = 0.05;
const EDITOR_ZOOM_DEFAULT = 1.0;
const FLOATING_TOOLBAR_STORAGE_KEY = 'yalkenLiteralStageAToolbarState';
const FLOATING_TOOLBAR_ITEM_OFFSETS_STORAGE_KEY = 'yalkenLiteralStageAToolbarItemOffsets';
const LEFT_FLOATING_TOOLBAR_STORAGE_KEY = 'yalkenLeftToolbarState';
const LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY = 'yalkenLeftToolbarButtonOffsets';
const CONFIGURATOR_BUCKETS_STORAGE_KEY = 'yalkenConfiguratorBuckets';
const SPATIAL_LAYOUT_STORAGE_KEY_PREFIX = 'yalkenSpatialLayout';
const SPATIAL_LAYOUT_LAST_STABLE_STORAGE_KEY_PREFIX = 'yalkenSpatialLayoutLastStable';
const SPATIAL_LAYOUT_VERSION = 1;
const SPATIAL_LAYOUT_MOBILE_BREAKPOINT = 900;
const SPATIAL_LAYOUT_COMPACT_BREAKPOINT = 1280;
const SPATIAL_LAYOUT_LEFT_MIN_WIDTH = 200;
const SPATIAL_LAYOUT_LEFT_MAX_WIDTH = 600;
const SPATIAL_LAYOUT_RIGHT_MIN_WIDTH = 250;
const SPATIAL_LAYOUT_RIGHT_MAX_WIDTH = 420;
const SPATIAL_LAYOUT_DESKTOP_LEFT_BASELINE_WIDTH = 290;
const SPATIAL_LAYOUT_DESKTOP_RIGHT_BASELINE_WIDTH = 340;
const SPATIAL_LAYOUT_COMPACT_LEFT_BASELINE_WIDTH = 260;
const SPATIAL_LAYOUT_COMPACT_RIGHT_BASELINE_WIDTH = 290;
const SPATIAL_LAYOUT_MOBILE_LEFT_BASELINE_WIDTH = 240;
const SPATIAL_LAYOUT_ENVELOPE_SIGNATURE_VERSION = 1;
const SPATIAL_LAYOUT_MISSING_MONITOR_SHRINK_PX = 320;
const SPATIAL_LAYOUT_MISSING_MONITOR_SHRINK_RATIO = 0.25;
const SAFE_RESET_BASELINE_THEME = 'light';
const SAFE_RESET_BASELINE_FONT_FAMILY = '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const SAFE_RESET_BASELINE_FONT_SIZE_PX = 12;
const SAFE_RESET_BASELINE_FONT_WEIGHT = 'light';
const SAFE_RESET_BASELINE_LINE_HEIGHT = '1.0';
const SAFE_RESET_BASELINE_VIEW_MODE = 'default';
const PROJECT_WORKSPACE_RESET_TABS = Object.freeze(['project', 'outline', 'search', 'roman']);
const FLOATING_TOOLBAR_DRAG_THRESHOLD_PX = 6;
const FLOATING_TOOLBAR_ROTATE_THRESHOLD_PX = 30;
const FLOATING_TOOLBAR_SNAP_ZONE_PX = 30;
const FLOATING_TOOLBAR_CENTER_ANCHOR_PX = 30;
const FLOATING_TOOLBAR_ITEM_SNAP_THRESHOLD_PX = 10;
const FLOATING_TOOLBAR_VISIBLE_STRIP_PX = 56;
const FLOATING_TOOLBAR_SCALE_MIN = 0.5;
const FLOATING_TOOLBAR_SCALE_MAX = 2.0;
const FLOATING_TOOLBAR_WIDTH_SCALE_MIN = 0.1;
const FLOATING_TOOLBAR_WIDTH_SCALE_MAX = 2.0;
const FONT_WEIGHT_PRESETS = Object.freeze({
  light: { weight: '300', stretch: 'normal', spacing: '0em' },
  regular: { weight: '400', stretch: 'normal', spacing: '0em' },
  semibold: { weight: '600', stretch: 'normal', spacing: '0em' },
  bold: { weight: '700', stretch: 'normal', spacing: '0em' },
  condensed: { weight: '400', stretch: 'condensed', spacing: '-0.02em' },
  'condensed-light': { weight: '300', stretch: 'condensed', spacing: '-0.015em' },
  'condensed-bold': { weight: '700', stretch: 'condensed', spacing: '-0.025em' },
});
const LEGACY_FONT_WEIGHT_PRESET_MAP = Object.freeze({
  '300': 'light',
  '400': 'regular',
  '500': 'semibold',
  '600': 'semibold',
  '700': 'bold',
});
let editorZoom = EDITOR_ZOOM_DEFAULT;
const isMac = navigator.platform.toUpperCase().includes('MAC');
let currentFontSizePx = 16;
let wordWrapEnabled = true;
let collabScopeLocal = false;
let currentMode = 'write';
let currentLeftTab = 'project';
let currentRightTab = 'inspector';
let lastSearchQuery = '';
let plainTextBuffer = '';
const activeTab = 'roman';
let currentDocumentPath = null;
let currentDocumentKind = null;
let currentProjectId = '';
let spatialLayoutState = null;
let spatialLastStableLayoutState = null;
let floatingToolbarState = {
  position: { x: 0, y: 0 },
  compact: false,
  scale: 1,
  widthScale: 1,
};
let toolbarItemOffsets = {};
let leftFloatingToolbarState = {
  position: { x: 0, y: 0 },
  compact: false,
};
let leftToolbarButtonOffsets = {};
let configuratorBucketState = { master: [], minimal: [] };
let flowModeState = {
  active: false,
  scenes: [],
  dirty: false,
};
let designOsDormantRuntimeMount = {
  mounted: false,
  runtime: null,
  ports: null,
  bootstrap: null,
  lastError: null,
};
let designOsDormantDegradedToBaseline = false;
let designOsDormantVisibleCommandIds = null;
let designOsDormantLastSyncedProductTruthHash = null;
let metaEnabled = false;
let currentCards = [];
let treeRoot = null;
let currentMeta = {
  synopsis: '',
  status: 'черновик',
  tags: { pov: '', line: '', place: '' }
};
let expandedNodesByTab = new Map();
let autoSaveTimerId = null;
const AUTO_SAVE_DELAY = 600;
const HOTPATH_RENDER_DEBOUNCE_MS = 32;
const HOTPATH_FULL_RENDER_MIN_INTERVAL_MS = 280;
const HOTPATH_PAGINATION_IDLE_DELAY_MS = 220;
const HOTPATH_PAGINATION_IDLE_TIMEOUT_MS = 750;
const PAGINATION_MEASURE_BATCH_SIZE = 12;
const UI_ERROR_MAP_SCHEMA_VERSION = 'ui-error-map.v1';
const UI_ERROR_FALLBACK_MESSAGE = 'Операция не выполнена';
const UI_ERROR_FALLBACK_SEVERITY = 'ERROR';

const PX_PER_MM_AT_ZOOM_1 = 595 / 210;
const ZOOM_DEFAULT = 1.0;
const PAGE_GAP_MM = 20 / (595 / 210);
const CANVAS_PADDING_PX = 48;
const MARGIN_MM = 25.4;
const PAGE_FORMATS = {
  A4: 210,
  A5: 148,
  A6: 105
};

function mmToPx(mm, zoom = ZOOM_DEFAULT) {
  return mm * PX_PER_MM_AT_ZOOM_1 * zoom;
}

function getPageMetrics({ pageWidthMm, zoom = ZOOM_DEFAULT }) {
  const pageHeightMm = pageWidthMm * Math.SQRT2;
  const marginPx = mmToPx(MARGIN_MM, zoom);
  return {
    pageWidthPx: mmToPx(pageWidthMm, zoom),
    pageHeightPx: mmToPx(pageHeightMm, zoom),
    marginTopPx: marginPx,
    marginRightPx: marginPx,
    marginBottomPx: marginPx,
    marginLeftPx: marginPx,
    pageGapPx: mmToPx(PAGE_GAP_MM, zoom),
    canvasPaddingPx: CANVAS_PADDING_PX,
    pageHeightMm
  };
}

function applyPageViewCssVars(metrics) {
  const root = document.documentElement;
  root.style.setProperty('--page-width-px', `${Math.round(metrics.pageWidthPx)}px`);
  root.style.setProperty('--page-height-px', `${Math.round(metrics.pageHeightPx)}px`);
  root.style.setProperty('--page-gap-px', `${Math.round(metrics.pageGapPx)}px`);
  root.style.setProperty('--page-margin-top-px', `${Math.round(metrics.marginTopPx)}px`);
  root.style.setProperty('--page-margin-right-px', `${Math.round(metrics.marginRightPx)}px`);
  root.style.setProperty('--page-margin-bottom-px', `${Math.round(metrics.marginBottomPx)}px`);
  root.style.setProperty('--page-margin-left-px', `${Math.round(metrics.marginLeftPx)}px`);
  root.style.setProperty('--canvas-padding-px', `${metrics.canvasPaddingPx}px`);
}

const initialPageWidthMm = PAGE_FORMATS.A4;
const initialPageMetrics = getPageMetrics({ pageWidthMm: initialPageWidthMm, zoom: ZOOM_DEFAULT });
applyPageViewCssVars(initialPageMetrics);

const commandRegistry = createCommandRegistry();
const runCommand = createCommandRunner(commandRegistry, {
  capability: {
    defaultPlatformId: window.electronAPI ? 'node' : 'web',
  },
});
registerProjectCommands(commandRegistry, {
  electronAPI: window.electronAPI,
  uiActions: {
    undo: () => handleUndo(),
    redo: () => handleRedo(),
    find: () => handleFind(),
    replace: () => handleReplace(),
    zoomOut: () => handleZoomOut(),
    zoomIn: () => handleZoomIn(),
    toggleWrap: () => handleToggleWrap(),
    insertMarkdownPrompt: () => handleInsertMarkdownPrompt(),
    insertFlowOpen: () => handleInsertFlowOpen(),
    insertAddCard: () => handleInsertAddCard(),
    formatAlignLeft: () => handleFormatAlign('align-left'),
    formatAlignCenter: () => handleFormatAlign('align-center'),
    formatAlignRight: () => handleFormatAlign('align-right'),
    formatAlignJustify: () => handleFormatAlign('align-justify'),
    planFlowSave: () => handlePlanFlowSave(),
    reviewExportMarkdown: () => handleReviewExportMarkdown(),
    openSettings: () => openSettingsModal(),
    safeResetShell: () => performSafeResetShell(),
    restoreLastStableShell: () => performRestoreLastStableShell(),
    openDiagnostics: () => openDiagnosticsModal(),
    openRecovery: () => openRecoveryModal('Recovery modal opened from menu'),
    switchMode: (payload = {}) => {
      const mode = typeof payload.mode === 'string' ? payload.mode : '';
      if (mode === 'write' || mode === 'plan' || mode === 'review') {
        applyMode(mode);
      }
    },
    setTheme: (payload) => handleUiSetThemeCommand(payload),
    setFont: (payload) => handleUiSetFontCommand(payload),
    setFontSize: (payload) => handleUiSetFontSizeCommand(payload),
  },
});

const catalogManagedProjectCommandIds = new Set(listCommandCatalog().map((entry) => entry.id));

function normalizeDormantVisibleCommandIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((commandId) => typeof commandId === 'string' && commandId.trim().length > 0);
  return new Set(ids);
}

function filterPaletteCommandEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return false;
    if (!catalogManagedProjectCommandIds.has(entry.id)) return true;
    if (!(designOsDormantVisibleCommandIds instanceof Set)) return true;
    return designOsDormantVisibleCommandIds.has(entry.id);
  });
}

function createDormantAwarePaletteDataProvider(baseProvider) {
  return {
    listAll() {
      const entries = typeof baseProvider?.listAll === 'function' ? baseProvider.listAll() : [];
      return filterPaletteCommandEntries(entries);
    },
    listBySurface(surface) {
      const entries = typeof baseProvider?.listBySurface === 'function' ? baseProvider.listBySurface(surface) : [];
      return filterPaletteCommandEntries(entries);
    },
    listByGroup(surface) {
      const groups = typeof baseProvider?.listByGroup === 'function' ? baseProvider.listByGroup(surface) : [];
      if (!Array.isArray(groups)) return [];
      return groups
        .map((group) => {
          const commands = filterPaletteCommandEntries(group && Array.isArray(group.commands) ? group.commands : []);
          if (commands.length === 0) return null;
          return { ...group, commands };
        })
        .filter(Boolean);
    },
  };
}

const baseCommandPaletteDataProvider = createPaletteDataProvider(commandRegistry, { defaultSurface: 'palette' });
const commandPaletteDataProvider = createDormantAwarePaletteDataProvider(baseCommandPaletteDataProvider);
window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ = commandPaletteDataProvider;
const MARKDOWN_IMPORT_STATUS_MESSAGE = 'Imported Markdown v1';
const MARKDOWN_EXPORT_STATUS_MESSAGE = 'Exported Markdown v1';
const MARKDOWN_IMPORT_PROMPT_TITLE = 'Import Markdown v1';
const MARKDOWN_EXPORT_PROMPT_COPY_HINT = 'Export Markdown v1 (copy text below)';
const FLOW_OPEN_ERROR_MESSAGE = 'Flow mode unavailable';
const FLOW_SAVE_ERROR_MESSAGE = 'Flow mode save failed';

function sanitizeUiErrorMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { defaultUserMessage: UI_ERROR_FALLBACK_MESSAGE, index: new Map() };
  }
  const schemaVersion = typeof input.schemaVersion === 'string' ? input.schemaVersion : '';
  const defaultUserMessage = typeof input.defaultUserMessage === 'string' && input.defaultUserMessage.length > 0
    ? input.defaultUserMessage
    : UI_ERROR_FALLBACK_MESSAGE;
  if (schemaVersion !== UI_ERROR_MAP_SCHEMA_VERSION || !Array.isArray(input.map)) {
    return { defaultUserMessage, index: new Map() };
  }
  const index = new Map();
  for (const rule of input.map) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) continue;
    if (typeof rule.code !== 'string' || rule.code.length === 0) continue;
    if (typeof rule.userMessage !== 'string' || rule.userMessage.length === 0) continue;
    if (rule.severity !== 'ERROR' && rule.severity !== 'WARN') continue;
    if (index.has(rule.code)) continue;
    index.set(rule.code, { userMessage: rule.userMessage, severity: rule.severity });
  }
  return { defaultUserMessage, index };
}

const uiErrorMap = sanitizeUiErrorMap(uiErrorMapDoc);

function mapCommandErrorToUi(error) {
  const source = error && typeof error === 'object' && !Array.isArray(error)
    ? error
    : {};
  const code = typeof source.code === 'string' && source.code.length > 0
    ? source.code
    : 'E_COMMAND_FAILED';
  const op = typeof source.op === 'string' && source.op.length > 0 ? source.op : '';
  const details = source.details && typeof source.details === 'object' && !Array.isArray(source.details)
    ? source.details
    : null;
  const recoveryActions = details && Array.isArray(details.recoveryActions)
    ? details.recoveryActions.filter((item) => typeof item === 'string' && item.length > 0).slice(0, 3)
    : [];
  const detailsUserMessage = details && typeof details.userMessage === 'string' && details.userMessage.length > 0
    ? details.userMessage
    : '';
  const actionSuffix = recoveryActions.length > 0 ? ` [${recoveryActions.join(' / ')}]` : '';
  if (detailsUserMessage) {
    return {
      userMessage: `${detailsUserMessage}${actionSuffix}`,
      severity: code.startsWith('E_IO_') ? 'WARN' : UI_ERROR_FALLBACK_SEVERITY,
      code,
      op,
    };
  }
  const mapped = uiErrorMap.index.get(code);
  if (mapped) {
    return {
      userMessage: mapped.userMessage,
      severity: mapped.severity,
      code,
      op,
    };
  }
  return {
    userMessage: uiErrorMap.defaultUserMessage,
    severity: UI_ERROR_FALLBACK_SEVERITY,
    code,
    op,
  };
}

async function dispatchUiCommand(commandId, payload = {}) {
  const result = await runCommandThroughBus(runCommand, commandId, payload, {
    route: COMMAND_BUS_ROUTE,
  });
  if (!result.ok) {
    const mapped = mapCommandErrorToUi(result.error);
    updateStatusText(mapped.userMessage);
    if (mapped.severity === 'ERROR') {
      const opSuffix = mapped.op ? ` op=${mapped.op}` : '';
      console.error(`UI_COMMAND_ERROR code=${mapped.code}${opSuffix}`);
    }
  }
  return result;
}

async function invokeWorkspaceQueryBridge(queryId, payload = {}) {
  if (!window.electronAPI || typeof window.electronAPI.invokeWorkspaceQueryBridge !== 'function') {
    throw new Error('WORKSPACE_QUERY_BRIDGE_UNAVAILABLE');
  }
  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  return window.electronAPI.invokeWorkspaceQueryBridge({ queryId, payload: safePayload });
}

async function invokeSaveLifecycleSignalBridge(signalId, payload = {}) {
  if (!window.electronAPI || typeof window.electronAPI.invokeSaveLifecycleSignalBridge !== 'function') {
    return { ok: false, error: 'SAVE_LIFECYCLE_SIGNAL_BRIDGE_UNAVAILABLE' };
  }
  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  try {
    return await window.electronAPI.invokeSaveLifecycleSignalBridge({ signalId, payload: safePayload });
  } catch (error) {
    return {
      ok: false,
      error: 'SAVE_LIFECYCLE_SIGNAL_BRIDGE_FAILED',
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function resolveSceneFromImportResult(importResult) {
  if (!importResult || importResult.ok !== true) return null;
  const value = importResult.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const scene = value.scene;
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return null;
  return scene;
}

async function runMarkdownImportCommand(markdownText, sourceName) {
  return dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, {
    text: markdownText,
    sourceName,
  });
}

async function runMarkdownExportCommand(scene) {
  return dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, { scene });
}

async function runFlowOpenCommand() {
  return dispatchUiCommand(COMMAND_IDS.PROJECT_FLOW_OPEN_V1);
}

async function runFlowSaveCommand(scenes) {
  return dispatchUiCommand(COMMAND_IDS.PROJECT_FLOW_SAVE_V1, { scenes });
}

function clearFlowModeState() {
  flowModeState = {
    active: false,
    scenes: [],
    dirty: false,
  };
}

function normalizeFlowSceneRefs(rawScenes) {
  const scenes = Array.isArray(rawScenes) ? rawScenes : [];
  return scenes
    .map((scene) => {
      if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return null;
      const path = typeof scene.path === 'string' ? scene.path : '';
      const title = typeof scene.title === 'string' ? scene.title : '';
      const kind = typeof scene.kind === 'string' ? scene.kind : 'scene';
      const content = typeof scene.content === 'string' ? scene.content : '';
      if (!path) return null;
      return { path, title, kind, content };
    })
    .filter(Boolean);
}

async function handleFlowModeOpenUiPath() {
  if (flowModeState.active && flowModeState.dirty) {
    updateStatusText(buildFlowModeReopenBlockedStatus(flowModeState.scenes.length));
    return;
  }

  const openResult = await runFlowOpenCommand();
  if (!openResult.ok) return;

  const scenes = normalizeFlowSceneRefs(openResult.value && openResult.value.scenes);
  if (!scenes.length) {
    updateStatusText(FLOW_OPEN_ERROR_MESSAGE);
    return;
  }

  flowModeState = {
    active: true,
    scenes: scenes.map((scene) => ({ path: scene.path, title: scene.title, kind: scene.kind })),
    dirty: false,
  };

  setPlainText(composeFlowDocument(scenes));
  updateWordCount();
  localDirty = false;
  await invokeSaveLifecycleSignalBridge('signal.localDirty.set', { state: false });
  showEditorPanelFor('Flow mode');
  remountDesignOsDormantRuntimeForCurrentDocumentContext();
  updateStatusText(buildFlowModeM9KickoffStatus('open', scenes.length, { m8Kickoff: true, m9Kickoff: true }));
}

async function handleFlowModeSaveUiPath() {
  if (!flowModeState.active) {
    updateStatusText(FLOW_SAVE_ERROR_MESSAGE);
    return;
  }

  if (!flowModeState.dirty) {
    updateStatusText(buildFlowModeM9NextNoopSaveStatus(flowModeState.scenes.length));
    return;
  }

  const payload = buildFlowSavePayload(getPlainText(), flowModeState.scenes);
  if (!payload.ok) {
    updateStatusText(buildFlowModeM9CoreSaveErrorStatus(payload.error, flowModeState.scenes.length));
    return;
  }

  const saveResult = await runFlowSaveCommand(payload.scenes);
  if (!saveResult.ok) return;

  flowModeState = {
    ...flowModeState,
    dirty: false,
  };
  localDirty = false;
  await invokeSaveLifecycleSignalBridge('signal.localDirty.set', { state: false });
  remountDesignOsDormantRuntimeForCurrentDocumentContext();
  updateStatusText(buildFlowModeM9KickoffStatus('save', payload.scenes.length, { m8Kickoff: true, m9Kickoff: true }));
}

async function handleMarkdownImportUiPath() {
  if (typeof window.prompt !== 'function') {
    updateStatusText('Import Markdown unavailable');
    return;
  }
  const currentText = getPlainText();
  const markdown = window.prompt(MARKDOWN_IMPORT_PROMPT_TITLE, currentText);
  if (markdown === null) return;

  const importResult = await runMarkdownImportCommand(markdown, 'ui-import.md');
  if (!importResult.ok) return;

  const scene = resolveSceneFromImportResult(importResult);
  if (!scene) {
    updateStatusText('Imported Markdown v1 scene missing');
    return;
  }

  const exportResult = await runMarkdownExportCommand(scene);
  if (exportResult.ok && exportResult.value && typeof exportResult.value.markdown === 'string') {
    setPlainText(exportResult.value.markdown);
  } else {
    setPlainText(markdown);
  }
  updateWordCount();
  markAsModified();
  updateStatusText(MARKDOWN_IMPORT_STATUS_MESSAGE);
}

async function handleMarkdownExportUiPath() {
  const sourceText = getPlainText();
  const importResult = await runMarkdownImportCommand(sourceText, 'editor-buffer.md');
  if (!importResult.ok) return;

  const scene = resolveSceneFromImportResult(importResult);
  if (!scene) {
    updateStatusText('Export Markdown unavailable');
    return;
  }

  const exportResult = await runMarkdownExportCommand(scene);
  if (!exportResult.ok || !exportResult.value || typeof exportResult.value.markdown !== 'string') {
    return;
  }

  const markdown = exportResult.value.markdown;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(markdown).catch(() => {});
  }
  if (typeof window.prompt === 'function') {
    window.prompt(MARKDOWN_EXPORT_PROMPT_COPY_HINT, markdown);
  }
  updateStatusText(MARKDOWN_EXPORT_STATUS_MESSAGE);
}

function getPlainText() {
  if (isTiptapMode) {
    plainTextBuffer = getTiptapPlainText();
  }
  return plainTextBuffer;
}

let deferredRenderTimerId = null;
let deferredPaginationTimerId = null;
let deferredRenderIncludePagination = false;
let deferredRenderPreserveSelection = true;
let incrementalInputDomSyncScheduled = false;
let lastFullRenderAtMs = 0;
let legacyCompositionActive = false;
let legacyCompositionRenderPending = false;

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function cancelDeferredRenderWork() {
  if (deferredRenderTimerId) {
    window.clearTimeout(deferredRenderTimerId);
    deferredRenderTimerId = null;
  }
  if (deferredPaginationTimerId) {
    window.clearTimeout(deferredPaginationTimerId);
    deferredPaginationTimerId = null;
  }
  deferredRenderIncludePagination = false;
  deferredRenderPreserveSelection = true;
}

function setPlainText(text = '', options = {}) {
  plainTextBuffer = text;
  if (isTiptapMode) {
    cancelDeferredRenderWork();
    setTiptapPlainText(text);
    return;
  }
  const includePagination = options.includePagination !== false;
  const preserveSelection = options.preserveSelection !== false;
  if (options.deferRender === true) {
    scheduleDeferredHotpathRender({ includePagination, preserveSelection });
    return;
  }
  cancelDeferredRenderWork();
  renderStyledView(text, { includePagination, preserveSelection });
}

function parseIndentedValue(lines, startIndex) {
  const valueLines = [];
  const firstLine = lines[startIndex];
  const rawValue = firstLine.split(':').slice(1).join(':').trim();
  valueLines.push(rawValue);
  let index = startIndex + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (/^[a-zA-Zа-яА-ЯёЁ]+\s*:/.test(line)) {
      break;
    }
    if (line.startsWith('  ') || line.startsWith('\t')) {
      valueLines.push(line.trim());
    }
    index += 1;
  }
  return { value: valueLines.join('\n').trim(), nextIndex: index };
}

function parseTagsValue(value) {
  const tags = { pov: '', line: '', place: '' };
  value.split(';').forEach((chunk) => {
    const [rawKey, ...rest] = chunk.split('=');
    const key = (rawKey || '').trim().toLowerCase();
    const val = rest.join('=').trim();
    if (key === 'pov') tags.pov = val;
    if (key === 'линия') tags.line = val;
    if (key === 'место') tags.place = val;
  });
  return tags;
}

function parseMetaBlock(block) {
  const meta = {
    synopsis: '',
    status: 'черновик',
    tags: { pov: '', line: '', place: '' }
  };
  const body = block.replace(/\[\/?meta\]/gi, '').trim();
  const lines = body.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (line.toLowerCase().startsWith('status:')) {
      meta.status = line.split(':').slice(1).join(':').trim() || meta.status;
      index += 1;
      continue;
    }
    if (line.toLowerCase().startsWith('tags:')) {
      const value = line.split(':').slice(1).join(':').trim();
      meta.tags = parseTagsValue(value);
      index += 1;
      continue;
    }
    if (line.toLowerCase().startsWith('synopsis:')) {
      const parsed = parseIndentedValue(lines, index);
      meta.synopsis = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    index += 1;
  }
  return meta;
}

function parseCardBlock(block) {
  const card = { title: '', text: '', tags: '' };
  const body = block.replace(/\[\/?card\]/gi, '').trim();
  const lines = body.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (line.toLowerCase().startsWith('title:')) {
      card.title = line.split(':').slice(1).join(':').trim();
      index += 1;
      continue;
    }
    if (line.toLowerCase().startsWith('tags:')) {
      card.tags = line.split(':').slice(1).join(':').trim();
      index += 1;
      continue;
    }
    if (line.toLowerCase().startsWith('text:')) {
      const parsed = parseIndentedValue(lines, index);
      card.text = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    index += 1;
  }
  return card;
}

function parseCardsBlock(block) {
  const cards = [];
  const body = block.replace(/\[\/?cards\]/gi, '').trim();
  const regex = /\[card\][\s\S]*?\[\/card\]/gi;
  let match = regex.exec(body);
  while (match) {
    cards.push(parseCardBlock(match[0]));
    match = regex.exec(body);
  }
  return cards;
}

function parseDocumentContent(rawText = '') {
  let content = String(rawText || '');
  let meta = { synopsis: '', status: 'черновик', tags: { pov: '', line: '', place: '' } };
  let cards = [];

  const metaMatch = content.match(/\[meta\][\s\S]*?\[\/meta\]/i);
  if (metaMatch) {
    meta = parseMetaBlock(metaMatch[0]);
    content = content.replace(metaMatch[0], '');
  }

  const cardsMatch = content.match(/\[cards\][\s\S]*?\[\/cards\]/i);
  if (cardsMatch) {
    cards = parseCardsBlock(cardsMatch[0]);
    content = content.replace(cardsMatch[0], '');
  }

  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.replace(/^\n+/, '');
  content = content.replace(/\n+$/, '');

  return { text: content, meta, cards };
}

function composeMetaBlock(meta) {
  if (!metaEnabled) return '';
  const lines = ['[meta]'];
  const status = meta.status || 'черновик';
  const tags = `POV=${meta.tags.pov || ''}; линия=${meta.tags.line || ''}; место=${meta.tags.place || ''}`;
  lines.push(`status: ${status}`);
  lines.push(`tags: ${tags}`);
  const synopsisLines = String(meta.synopsis || '').split('\n');
  if (synopsisLines.length) {
    lines.push(`synopsis: ${synopsisLines[0] || ''}`);
    for (let i = 1; i < synopsisLines.length; i += 1) {
      lines.push(`  ${synopsisLines[i]}`);
    }
  } else {
    lines.push('synopsis:');
  }
  lines.push('[/meta]');
  return lines.join('\n');
}

function composeCardsBlock(cards) {
  if (!cards || !cards.length) return '';
  const lines = ['[cards]'];
  cards.forEach((card) => {
    lines.push('[card]');
    lines.push(`title: ${card.title || ''}`);
    const textLines = String(card.text || '').split('\n');
    lines.push(`text: ${textLines[0] || ''}`);
    for (let i = 1; i < textLines.length; i += 1) {
      lines.push(`  ${textLines[i]}`);
    }
    lines.push(`tags: ${card.tags || ''}`);
    lines.push('[/card]');
  });
  lines.push('[/cards]');
  return lines.join('\n');
}

function composeDocumentContent() {
  const parts = [];
  const metaBlock = composeMetaBlock(currentMeta);
  if (metaBlock) {
    parts.push(metaBlock);
  }
  parts.push(getPlainText());
  const cardsBlock = composeCardsBlock(currentCards);
  if (cardsBlock) {
    parts.push(cardsBlock);
  }
  return parts.filter(Boolean).join('\n\n');
}

function getSelectionOffsets() {
  if (isTiptapMode) {
    const length = getPlainText().length;
    return { start: length, end: length };
  }
  if (!editor) return { start: 0, end: 0 };
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { start: 0, end: 0 };
  }
  const range = selection.getRangeAt(0);
  const normalizePosition = (node, offset) => {
    const boundaryRange = document.createRange();
    boundaryRange.setStart(editor, 0);
    boundaryRange.setEnd(node, offset);
    return boundaryRange.toString().length;
  };
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return { start: 0, end: 0 };
  }
  const startOffset = normalizePosition(range.startContainer, range.startOffset);
  const endOffset = normalizePosition(range.endContainer, range.endOffset);
  return {
    start: Math.min(startOffset, endOffset),
    end: Math.max(startOffset, endOffset),
  };
}

function getNodeForOffset(offset) {
  if (!editor) return { node: editor || document.body, offset: 0 };
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
  let accumulated = 0;
  let currentNode = walker.nextNode();
  while (currentNode) {
    const length = currentNode.textContent?.length || 0;
    if (offset <= accumulated + length) {
      return { node: currentNode, offset: Math.max(0, offset - accumulated) };
    }
    accumulated += length;
    currentNode = walker.nextNode();
  }
  return { node: editor, offset: editor.childNodes.length };
}

function setSelectionRange(start, end) {
  if (isTiptapMode) return;
  if (!editor) return;
  const text = getPlainText();
  const normalizedStart = Math.max(0, Math.min(start, text.length));
  const normalizedEnd = Math.max(0, Math.min(end, text.length));
  const startPosition = getNodeForOffset(normalizedStart);
  const endPosition = getNodeForOffset(normalizedEnd);
  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectAllEditor() {
  const length = getPlainText().length;
  setSelectionRange(0, length);
}

function renderNodesWithoutPagination(nodes) {
  if (isTiptapMode) return;
  if (!editor) return;
  editor.innerHTML = '';
  const page = createPageElement(true, 0);
  const content = page.querySelector('.editor-page__content');
  const fragment = document.createDocumentFragment();
  nodes.forEach((node) => {
    fragment.appendChild(node);
  });
  content.appendChild(fragment);
  editor.appendChild(page);
}

function renderStyledView(text = '', options = {}) {
  if (isTiptapMode) {
    plainTextBuffer = text;
    return;
  }
  if (!editor) return;
  const includePagination = options.includePagination !== false;
  const preserveSelection = options.preserveSelection !== false;
  const { start, end } = preserveSelection ? getSelectionOffsets() : { start: 0, end: 0 };
  if (!text) {
    editor.innerHTML = '';
    createEmptyPage();
    if (preserveSelection) {
      setSelectionRange(0, 0);
    }
    lastFullRenderAtMs = nowMs();
    return;
  }

  const nodes = [];
  const lines = text.split('\n');
  let inCodeBlock = false;

  const createLineElement = (styleClass, markerText, contentText) => {
    const lineEl = document.createElement('div');
    lineEl.classList.add('editor-line', styleClass);
    if (markerText) {
      const marker = document.createElement('span');
      marker.classList.add('marker');
      marker.textContent = markerText;
      lineEl.appendChild(marker);
    }
    const content = document.createElement('span');
    content.classList.add('content');
    content.textContent = contentText;
    lineEl.appendChild(content);
    return lineEl;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '```') {
      nodes.push(createLineElement('line--code-fence', '```', ''));
      inCodeBlock = !inCodeBlock;
    } else if (inCodeBlock) {
      nodes.push(createLineElement('line--codeblock', '', line));
    } else {
      const { styleClass, marker, content } = parseParagraphLine(line);
      nodes.push(createLineElement(styleClass, marker, content));
    }

    if (index < lines.length - 1) {
      nodes.push(document.createTextNode('\n'));
    }
  });

  if (includePagination) {
    editor.innerHTML = '';
    paginateNodes(nodes);
  } else {
    renderNodesWithoutPagination(nodes);
  }
  if (preserveSelection) {
    setSelectionRange(start, end);
  }
  lastFullRenderAtMs = nowMs();
}

function createPageElement(isFirstPage = false, pageIndex = 0) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('editor-page-wrap');
  wrapper.dataset.pageIndex = String(pageIndex);

  const page = document.createElement('div');
  page.classList.add('editor-page');
  const content = document.createElement('div');
  content.classList.add('editor-page__content');
  page.appendChild(content);
  wrapper.appendChild(page);
  return wrapper;
}

function createEmptyPage() {
  if (isTiptapMode) return;
  if (!editor) return;
  editor.innerHTML = '';
  const page = createPageElement(true, 0);
  editor.appendChild(page);
}

function paginateNodes(nodes) {
  if (isTiptapMode) return;
  if (!editor) return;
  if (!nodes.length) {
    createEmptyPage();
    return;
  }

  const isOverflowing = (contentEl) => {
    const limit = contentEl.clientHeight;
    return limit > 0 && contentEl.scrollHeight > limit;
  };

  const moveTailOverflow = (contentEl) => {
    const overflow = [];
    while (contentEl.childNodes.length > 1 && isOverflowing(contentEl)) {
      const tailNode = contentEl.lastChild;
      if (!tailNode) break;
      overflow.unshift(tailNode);
      contentEl.removeChild(tailNode);
    }
    return overflow;
  };

  let pageIndexCounter = 0;
  let currentPage = createPageElement(true, pageIndexCounter++);
  editor.appendChild(currentPage);
  let currentContent = currentPage.querySelector('.editor-page__content');
  let pendingMeasureCount = 0;

  const flushOverflowIfNeeded = () => {
    if (pendingMeasureCount === 0) {
      return;
    }
    pendingMeasureCount = 0;
    if (!isOverflowing(currentContent)) {
      return;
    }
    let overflowNodes = moveTailOverflow(currentContent);
    while (overflowNodes.length > 0) {
      currentPage = createPageElement(false, pageIndexCounter++);
      editor.appendChild(currentPage);
      currentContent = currentPage.querySelector('.editor-page__content');
      const fragment = document.createDocumentFragment();
      overflowNodes.forEach((node) => {
        fragment.appendChild(node);
      });
      currentContent.appendChild(fragment);
      overflowNodes = moveTailOverflow(currentContent);
    }
  };

  nodes.forEach((node, index) => {
    currentContent.appendChild(node);
    pendingMeasureCount += 1;
    const mustMeasure = pendingMeasureCount >= PAGINATION_MEASURE_BATCH_SIZE || index === nodes.length - 1;
    if (mustMeasure) {
      flushOverflowIfNeeded();
    }
  });
}

let layoutRefreshScheduled = false;
function scheduleLayoutRefresh() {
  if (isTiptapMode) return;
  if (layoutRefreshScheduled) {
    return;
  }
  layoutRefreshScheduled = true;
  window.requestAnimationFrame(() => {
    layoutRefreshScheduled = false;
    renderStyledView(getPlainText(), { includePagination: true });
  });
}

function scheduleDeferredHotpathRender(options = {}) {
  if (isTiptapMode) return;
  const includePagination = options.includePagination === true;
  const preserveSelection = options.preserveSelection !== false;
  deferredRenderIncludePagination = deferredRenderIncludePagination || includePagination;
  deferredRenderPreserveSelection = deferredRenderPreserveSelection && preserveSelection;
  if (deferredRenderTimerId) {
    window.clearTimeout(deferredRenderTimerId);
    deferredRenderTimerId = null;
  }
  const elapsedSinceFullRender = nowMs() - lastFullRenderAtMs;
  const throttledDelay = Math.max(0, HOTPATH_FULL_RENDER_MIN_INTERVAL_MS - elapsedSinceFullRender);
  const nextDelay = Math.max(HOTPATH_RENDER_DEBOUNCE_MS, throttledDelay);
  deferredRenderTimerId = window.setTimeout(() => {
    deferredRenderTimerId = null;
    const nextIncludePagination = deferredRenderIncludePagination;
    const nextPreserveSelection = deferredRenderPreserveSelection;
    deferredRenderIncludePagination = false;
    deferredRenderPreserveSelection = true;
    renderStyledView(getPlainText(), {
      includePagination: nextIncludePagination,
      preserveSelection: nextPreserveSelection,
    });
  }, nextDelay);
}

function scheduleDeferredPaginationRefresh() {
  if (isTiptapMode) return;
  if (deferredPaginationTimerId) {
    window.clearTimeout(deferredPaginationTimerId);
    deferredPaginationTimerId = null;
  }
  deferredPaginationTimerId = window.setTimeout(() => {
    deferredPaginationTimerId = null;
    const runPaginationPass = () => {
      scheduleDeferredHotpathRender({ includePagination: true, preserveSelection: true });
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(runPaginationPass, { timeout: HOTPATH_PAGINATION_IDLE_TIMEOUT_MS });
      return;
    }
    runPaginationPass();
  }, HOTPATH_PAGINATION_IDLE_DELAY_MS);
}

function normalizeActiveTextNodeWhitespace() {
  if (isTiptapMode) return;
  const selection = window.getSelection();
  const activeNode = selection && selection.anchorNode;
  if (!activeNode || !editor.contains(activeNode) || activeNode.nodeType !== Node.TEXT_NODE) {
    return;
  }
  if (activeNode.textContent && activeNode.textContent.includes('\u00a0')) {
    activeNode.textContent = activeNode.textContent.replace(/\u00a0/g, ' ');
  }
}

function scheduleIncrementalInputDomSync() {
  if (incrementalInputDomSyncScheduled) {
    return;
  }
  incrementalInputDomSyncScheduled = true;
  window.requestAnimationFrame(() => {
    incrementalInputDomSyncScheduled = false;
    normalizeActiveTextNodeWhitespace();
  });
}

function syncPlainTextBufferFromEditorDom() {
  if (isTiptapMode) {
    plainTextBuffer = getTiptapPlainText();
    return;
  }
  plainTextBuffer = (editor.textContent || '').replace(/\u00a0/g, ' ');
}

function flushLegacyCompositionRender() {
  legacyCompositionRenderPending = false;
  scheduleIncrementalInputDomSync();
  syncPlainTextBufferFromEditorDom();
  scheduleDeferredHotpathRender({ includePagination: false, preserveSelection: true });
  scheduleDeferredPaginationRefresh();
  markAsModified();
  updateWordCount();
}

let lastPointerDownPageIndex = -1;

function getPageWrapFromNode(node) {
  if (!node) {
    return null;
  }
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element || typeof element.closest !== 'function') {
    return null;
  }
  return element.closest('.editor-page-wrap');
}

function getPageIndexFromWrap(wrap) {
  if (!wrap) {
    return null;
  }
  const index = Number(wrap.dataset.pageIndex);
  return Number.isFinite(index) ? index : null;
}

function getPageIndexFromNode(node) {
  const wrap = getPageWrapFromNode(node);
  return getPageIndexFromWrap(wrap);
}

function getSelectionPageIndex(selection) {
  const activeSelection = selection || window.getSelection();
  if (!activeSelection || activeSelection.rangeCount === 0) {
    return null;
  }
  const anchorNode = activeSelection.anchorNode;
  if (!anchorNode) {
    return null;
  }
  return getPageIndexFromNode(anchorNode);
}

function getPageContentByIndex(index) {
  if (index == null || index < 0 || !editor) {
    return null;
  }
  const page = editor.querySelector(`.editor-page-wrap[data-page-index="${index}"]`);
  return page ? page.querySelector('.editor-page__content') : null;
}

function moveSelectionToPageContent(pageContent) {
  if (!pageContent) {
    return;
  }
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.setStart(pageContent, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function ensureCaretInLastPointerPage() {
  if (lastPointerDownPageIndex < 0) {
    return;
  }
  const activeIndex = getSelectionPageIndex();
  if (activeIndex === lastPointerDownPageIndex) {
    return;
  }
  const targetContent = getPageContentByIndex(lastPointerDownPageIndex);
  moveSelectionToPageContent(targetContent);
}

function parseParagraphLine(line) {
  const patternMatchers = [
    { prefix: '---[ SCENE ', className: 'line--heading2' },
    { prefix: '::caption:: ', className: 'line--caption' },
    { prefix: '::center:: ', className: 'line--centered' },
    { prefix: '::right:: ', className: 'line--align-right' },
    { prefix: '::justify:: ', className: 'line--align-justify' },
    { prefix: '::verse:: ', className: 'line--verse' },
    { prefix: '— ', className: 'line--attribution' },
    { prefix: '### ', className: 'line--heading2' },
    { prefix: '## ', className: 'line--heading1' },
    { prefix: '# ', className: 'line--title' },
    { prefix: '> ', className: 'line--blockquote' },
  ];

  for (const matcher of patternMatchers) {
    if (line.startsWith(matcher.prefix)) {
      return {
        styleClass: matcher.className,
        marker: matcher.prefix,
        content: line.slice(matcher.prefix.length),
      };
    }
  }

  return {
    styleClass: 'line--paragraph',
    marker: '',
    content: line,
  };
}

function positionCaretForCurrentText() {
  if (!editor) return;
  const textLength = Math.max(0, (getPlainText() || '').length);
  setSelectionRange(textLength, textLength);
}

function normalizeProjectId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getActiveDocumentTitleStorageKey(projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  return normalizedProjectId ? `activeDocumentTitle:${normalizedProjectId}` : 'activeDocumentTitle';
}

function getTreeExpandedStorageKey(tab, projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedTab = typeof tab === 'string' && tab ? tab : activeTab;
  return normalizedProjectId
    ? `treeExpanded:${normalizedProjectId}:${normalizedTab}`
    : `treeExpanded:${normalizedTab}`;
}

function readWorkspaceStorage(primaryKey, legacyKey = primaryKey) {
  try {
    const primaryValue = localStorage.getItem(primaryKey);
    if (primaryValue !== null || primaryKey === legacyKey) {
      return primaryValue;
    }
    return localStorage.getItem(legacyKey);
  } catch {
    return null;
  }
}

function getSpatialLayoutStorageKey(projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  return normalizedProjectId
    ? `${SPATIAL_LAYOUT_STORAGE_KEY_PREFIX}:${normalizedProjectId}`
    : SPATIAL_LAYOUT_STORAGE_KEY_PREFIX;
}

function getSpatialLastStableLayoutStorageKey(projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  return normalizedProjectId
    ? `${SPATIAL_LAYOUT_LAST_STABLE_STORAGE_KEY_PREFIX}:${normalizedProjectId}`
    : SPATIAL_LAYOUT_LAST_STABLE_STORAGE_KEY_PREFIX;
}

function getSpatialLayoutViewportWidth() {
  return Math.max(0, Math.floor(window.innerWidth || document.documentElement.clientWidth || 0));
}

function getSpatialLayoutMode(viewportWidth = getSpatialLayoutViewportWidth()) {
  if (viewportWidth < SPATIAL_LAYOUT_MOBILE_BREAKPOINT) {
    return 'mobile';
  }
  if (viewportWidth < SPATIAL_LAYOUT_COMPACT_BREAKPOINT) {
    return 'compact';
  }
  return 'desktop';
}

function getSpatialLayoutConstraintsForViewport(viewportWidth = getSpatialLayoutViewportWidth()) {
  const mode = getSpatialLayoutMode(viewportWidth);
  if (mode === 'mobile') {
    return {
      mode,
      leftMin: SPATIAL_LAYOUT_LEFT_MIN_WIDTH,
      leftMax: SPATIAL_LAYOUT_MOBILE_LEFT_BASELINE_WIDTH,
      rightMin: SPATIAL_LAYOUT_RIGHT_MIN_WIDTH,
      rightMax: SPATIAL_LAYOUT_RIGHT_MAX_WIDTH,
      rightVisible: false,
    };
  }
  if (mode === 'compact') {
    return {
      mode,
      leftMin: 230,
      leftMax: 260,
      rightMin: 250,
      rightMax: 290,
      rightVisible: true,
    };
  }
  return {
    mode,
    leftMin: 250,
    leftMax: SPATIAL_LAYOUT_LEFT_MAX_WIDTH,
    rightMin: 280,
    rightMax: SPATIAL_LAYOUT_RIGHT_MAX_WIDTH,
    rightVisible: true,
  };
}

function getSpatialLayoutViewportEnvelope(viewportWidth = getSpatialLayoutViewportWidth()) {
  const normalizedViewportWidth = Math.max(0, Math.floor(Number(viewportWidth) || 0));
  const mode = getSpatialLayoutMode(normalizedViewportWidth);
  return {
    version: SPATIAL_LAYOUT_ENVELOPE_SIGNATURE_VERSION,
    mode,
    width: normalizedViewportWidth,
    signature: `${mode}:${normalizedViewportWidth}`,
  };
}

function isSpatialLayoutEnvelopeCompatible(rawState, viewportWidth = getSpatialLayoutViewportWidth()) {
  if (!rawState || typeof rawState !== 'object') {
    return false;
  }

  const currentEnvelope = getSpatialLayoutViewportEnvelope(viewportWidth);
  const savedEnvelope = rawState.viewportEnvelope && typeof rawState.viewportEnvelope === 'object'
    ? rawState.viewportEnvelope
    : rawState;
  const savedMode = typeof savedEnvelope.mode === 'string'
    ? savedEnvelope.mode
    : typeof rawState.viewportMode === 'string'
      ? rawState.viewportMode
      : '';
  const savedViewportWidth = Math.max(
    0,
    Math.floor(Number(savedEnvelope.width || rawState.viewportWidth || 0))
  );

  if (!savedMode || !savedViewportWidth) {
    return true;
  }

  if (savedMode !== currentEnvelope.mode) {
    return false;
  }

  const viewportShrinkPx = savedViewportWidth - currentEnvelope.width;
  if (viewportShrinkPx <= 0) {
    return true;
  }

  const missingMonitorThresholdPx = Math.max(
    SPATIAL_LAYOUT_MISSING_MONITOR_SHRINK_PX,
    Math.round(savedViewportWidth * SPATIAL_LAYOUT_MISSING_MONITOR_SHRINK_RATIO),
  );
  return viewportShrinkPx <= missingMonitorThresholdPx;
}

function getSpatialLayoutBaselineForViewport(viewportWidth = getSpatialLayoutViewportWidth(), projectId = currentProjectId) {
  const constraints = getSpatialLayoutConstraintsForViewport(viewportWidth);
  const viewportEnvelope = getSpatialLayoutViewportEnvelope(viewportWidth);
  if (constraints.mode === 'mobile') {
    return {
      version: SPATIAL_LAYOUT_VERSION,
      projectId: normalizeProjectId(projectId),
      leftSidebarWidth: SPATIAL_LAYOUT_MOBILE_LEFT_BASELINE_WIDTH,
      rightSidebarWidth: SPATIAL_LAYOUT_COMPACT_RIGHT_BASELINE_WIDTH,
      viewportWidth,
      viewportMode: constraints.mode,
      viewportEnvelope,
      savedAtUtc: '',
      source: 'baseline',
      recoveryReason: 'baseline',
    };
  }
  if (constraints.mode === 'compact') {
    return {
      version: SPATIAL_LAYOUT_VERSION,
      projectId: normalizeProjectId(projectId),
      leftSidebarWidth: SPATIAL_LAYOUT_COMPACT_LEFT_BASELINE_WIDTH,
      rightSidebarWidth: SPATIAL_LAYOUT_COMPACT_RIGHT_BASELINE_WIDTH,
      viewportWidth,
      viewportMode: constraints.mode,
      viewportEnvelope,
      savedAtUtc: '',
      source: 'baseline',
      recoveryReason: 'baseline',
    };
  }
  return {
    version: SPATIAL_LAYOUT_VERSION,
    projectId: normalizeProjectId(projectId),
    leftSidebarWidth: SPATIAL_LAYOUT_DESKTOP_LEFT_BASELINE_WIDTH,
    rightSidebarWidth: SPATIAL_LAYOUT_DESKTOP_RIGHT_BASELINE_WIDTH,
    viewportWidth,
    viewportMode: constraints.mode,
    viewportEnvelope,
    savedAtUtc: '',
    source: 'baseline',
    recoveryReason: 'baseline',
  };
}

function clampSpatialSidebarWidth(value, min, max) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return min;
  return Math.max(min, Math.min(max, Math.round(nextValue)));
}

function normalizeSpatialLayoutState(
  rawState,
  viewportWidth = getSpatialLayoutViewportWidth(),
  { source = 'stored', projectId = currentProjectId } = {}
) {
  const fallback = getSpatialLayoutBaselineForViewport(viewportWidth, projectId);
  const viewportEnvelope = getSpatialLayoutViewportEnvelope(viewportWidth);
  if (!rawState || typeof rawState !== 'object') {
    return {
      ...fallback,
      source: 'baseline',
      wasValid: false,
      recoveryReason: 'invalid-layout',
    };
  }

  const constraints = getSpatialLayoutConstraintsForViewport(viewportWidth);
  const leftSidebarWidth = clampSpatialSidebarWidth(
    rawState.leftSidebarWidth,
    constraints.leftMin,
    constraints.leftMax
  );
  const rightSidebarWidth = clampSpatialSidebarWidth(
    rawState.rightSidebarWidth,
    constraints.rightMin,
    constraints.rightMax
  );
  const isValid =
    rawState.version === SPATIAL_LAYOUT_VERSION &&
    isSpatialLayoutEnvelopeCompatible(rawState, viewportWidth) &&
    leftSidebarWidth >= constraints.leftMin &&
    leftSidebarWidth <= constraints.leftMax &&
    rightSidebarWidth >= constraints.rightMin &&
    rightSidebarWidth <= constraints.rightMax;

  if (!isValid) {
    return {
      ...fallback,
      source: 'baseline',
      wasValid: false,
      recoveryReason: isSpatialLayoutEnvelopeCompatible(rawState, viewportWidth)
        ? 'invalid-layout'
        : 'missing-monitor',
    };
  }

  return {
    version: SPATIAL_LAYOUT_VERSION,
    projectId: normalizeProjectId(rawState.projectId || projectId),
    leftSidebarWidth,
    rightSidebarWidth: constraints.rightVisible ? rightSidebarWidth : fallback.rightSidebarWidth,
    viewportWidth,
    viewportMode: constraints.mode,
    viewportEnvelope,
    savedAtUtc: typeof rawState.savedAtUtc === 'string' ? rawState.savedAtUtc : '',
    source,
    wasValid: true,
    recoveryReason: typeof rawState.recoveryReason === 'string' ? rawState.recoveryReason : 'stored',
  };
}

function readSpatialLayoutState(projectId = currentProjectId) {
  const raw = readWorkspaceStorage(getSpatialLayoutStorageKey(projectId), 'spatialLayout');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readSpatialLastStableLayoutState(projectId = currentProjectId) {
  const raw = readWorkspaceStorage(getSpatialLastStableLayoutStorageKey(projectId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistSpatialLayoutSnapshot(
  state,
  {
    projectId = currentProjectId,
    storageKey = getSpatialLayoutStorageKey(projectId),
    source = 'committed',
    updateCurrentLiveState = true,
    updateLastStableLiveState = false,
  } = {}
) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const nextState = {
    version: SPATIAL_LAYOUT_VERSION,
    projectId: normalizedProjectId,
    leftSidebarWidth: Math.round(Number(state?.leftSidebarWidth) || SPATIAL_LAYOUT_DESKTOP_LEFT_BASELINE_WIDTH),
    rightSidebarWidth: Math.round(Number(state?.rightSidebarWidth) || SPATIAL_LAYOUT_DESKTOP_RIGHT_BASELINE_WIDTH),
    viewportWidth: Math.max(0, Math.floor(Number(state?.viewportWidth) || getSpatialLayoutViewportWidth())),
    viewportMode: state?.viewportMode || getSpatialLayoutMode(),
    viewportEnvelope: state?.viewportEnvelope && typeof state.viewportEnvelope === 'object'
      ? state.viewportEnvelope
      : getSpatialLayoutViewportEnvelope(Math.max(0, Math.floor(Number(state?.viewportWidth) || getSpatialLayoutViewportWidth()))),
    savedAtUtc: new Date().toISOString(),
    source: state?.source || source,
    recoveryReason: typeof state?.recoveryReason === 'string' ? state.recoveryReason : '',
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextState));
  } catch {}
  if (updateCurrentLiveState) {
    spatialLayoutState = nextState;
  }
  if (updateLastStableLiveState) {
    spatialLastStableLayoutState = nextState;
  }
  return nextState;
}

function persistSpatialLayoutState(state, projectId = currentProjectId) {
  return persistSpatialLayoutSnapshot(state, {
    projectId,
    storageKey: getSpatialLayoutStorageKey(projectId),
    source: state?.source || 'committed',
    updateCurrentLiveState: true,
    updateLastStableLiveState: false,
  });
}

function persistSpatialLastStableLayoutState(state, projectId = currentProjectId) {
  return persistSpatialLayoutSnapshot(state, {
    projectId,
    storageKey: getSpatialLastStableLayoutStorageKey(projectId),
    source: state?.source || 'last-stable',
    updateCurrentLiveState: false,
    updateLastStableLiveState: true,
  });
}

function applySpatialLayoutState(state, { persist = false, projectId = currentProjectId } = {}) {
  const viewportWidth = getSpatialLayoutViewportWidth();
  const normalizedState = normalizeSpatialLayoutState(state, viewportWidth, {
    projectId,
    source: persist ? 'committed' : 'stored',
  });
  const constraints = getSpatialLayoutConstraintsForViewport(viewportWidth);

  if (appLayout) {
    appLayout.style.setProperty('--app-left-sidebar-width', `${normalizedState.leftSidebarWidth}px`);
    appLayout.style.setProperty('--app-right-sidebar-width', `${normalizedState.rightSidebarWidth}px`);
  }

  if (rightSidebar) {
    rightSidebar.hidden = !constraints.rightVisible;
  }
  if (rightSidebarResizer) {
    rightSidebarResizer.hidden = !constraints.rightVisible;
  }

  spatialLayoutState = {
    ...normalizedState,
    projectId: normalizeProjectId(projectId || normalizedState.projectId || currentProjectId),
    viewportWidth,
    viewportMode: constraints.mode,
    source: persist ? 'committed' : normalizedState.source,
  };

  if (persist) {
    persistSpatialLayoutState(spatialLayoutState, projectId);
  }

  return spatialLayoutState;
}

function resolveSpatialLayoutRecoveryCandidate(candidate, viewportWidth = getSpatialLayoutViewportWidth(), projectId = currentProjectId) {
  const normalizedCandidate = normalizeSpatialLayoutState(candidate.rawState, viewportWidth, {
    projectId,
    source: candidate.source,
  });
  const envelopeCompatible = candidate.rawState ? isSpatialLayoutEnvelopeCompatible(candidate.rawState, viewportWidth) : false;
  const recoveryReason = envelopeCompatible
    ? (normalizedCandidate.wasValid ? 'valid-current-envelope' : 'invalid-layout')
    : 'missing-monitor';
  return {
    ...normalizedCandidate,
    recoveryReason,
    recoverySource: candidate.source,
    wasValid: Boolean(normalizedCandidate.wasValid && envelopeCompatible),
  };
}

function recoverSpatialLayoutState(projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const viewportWidth = getSpatialLayoutViewportWidth();
  const candidates = [];

  if (spatialLayoutState && normalizeProjectId(spatialLayoutState.projectId) === normalizedProjectId) {
    candidates.push({
      rawState: spatialLayoutState,
      source: 'current',
    });
  }

  candidates.push(
    { rawState: readSpatialLayoutState(normalizedProjectId), source: 'stored-current' },
    { rawState: readSpatialLastStableLayoutState(normalizedProjectId), source: 'last-stable' },
  );

  for (const candidate of candidates) {
    const resolvedCandidate = resolveSpatialLayoutRecoveryCandidate(candidate, viewportWidth, normalizedProjectId);
    if (resolvedCandidate.wasValid) {
      return resolvedCandidate;
    }
  }

  return {
    ...getSpatialLayoutBaselineForViewport(viewportWidth, normalizedProjectId),
    wasValid: true,
    source: 'baseline',
  };
}

function restoreSpatialLayoutState(projectId = currentProjectId) {
  const resolvedState = recoverSpatialLayoutState(projectId);
  return applySpatialLayoutState(resolvedState, { persist: false, projectId });
}

function restoreLastStableSpatialLayoutState(projectId = currentProjectId) {
  const viewportWidth = getSpatialLayoutViewportWidth();
  const storedState = readSpatialLastStableLayoutState(projectId);
  const resolvedState = resolveSpatialLayoutRecoveryCandidate({
    rawState: storedState,
    source: 'last-stable',
  }, viewportWidth, projectId);
  const stateToApply = resolvedState.wasValid
    ? resolvedState
    : getSpatialLayoutBaselineForViewport(viewportWidth, projectId);
  return applySpatialLayoutState(stateToApply, { persist: false, projectId });
}

function commitSpatialLayoutState(projectId = currentProjectId) {
  const committedState = applySpatialLayoutState(spatialLayoutState || getSpatialLayoutBaselineForViewport(), {
    persist: false,
    projectId,
  });
  persistSpatialLayoutState(committedState, projectId);
  persistSpatialLastStableLayoutState(committedState, projectId);
  return committedState;
}

function updateSpatialLayoutForViewportChange() {
  const storedState = readSpatialLayoutState(currentProjectId);
  const resolvedState = normalizeSpatialLayoutState(storedState || spatialLayoutState, getSpatialLayoutViewportWidth());
  const recoveryState = recoverSpatialLayoutState(currentProjectId);
  applySpatialLayoutState(recoveryState.wasValid ? recoveryState : resolvedState, {
    persist: false,
    projectId: currentProjectId,
  });
}

function showEditorPanelFor(title) {
  editorPanel?.classList.add('active');
  mainContent?.classList.add('main-content--editor');
  emptyState?.classList.add('hidden');
  updateMetaVisibility();
  try {
    if (title) {
      localStorage.setItem(getActiveDocumentTitleStorageKey(currentProjectId), title);
    }
  } catch {}

  requestAnimationFrame(() => {
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
    if (editor) {
      editor.scrollTop = 0;
      try {
        editor.focus({ preventScroll: true });
      } catch {
        editor.focus();
      }
      positionCaretForCurrentText();
    }
  });
}

function collapseSelection() {
  clearFlowModeState();
  editorPanel?.classList.remove('active');
  mainContent?.classList.remove('main-content--editor');
  emptyState?.classList.remove('hidden');
  metaPanel?.classList.add('is-hidden');
  metaEnabled = false;
  currentMeta = { synopsis: '', status: 'черновик', tags: { pov: '', line: '', place: '' } };
  currentCards = [];
  updateCardsList();
  if (editor) {
    setPlainText('');
    updateWordCount();
  }
  updateInspectorSnapshot();
}

function updateMetaInputs() {
  if (!metaSynopsis || !metaStatus || !metaTagPov || !metaTagLine || !metaTagPlace) return;
  metaSynopsis.value = currentMeta.synopsis || '';
  metaStatus.value = currentMeta.status || 'черновик';
  metaTagPov.value = currentMeta.tags.pov || '';
  metaTagLine.value = currentMeta.tags.line || '';
  metaTagPlace.value = currentMeta.tags.place || '';
}

function syncMetaFromInputs() {
  if (!metaSynopsis || !metaStatus || !metaTagPov || !metaTagLine || !metaTagPlace) return;
  currentMeta = {
    synopsis: metaSynopsis.value || '',
    status: metaStatus.value || 'черновик',
    tags: {
      pov: metaTagPov.value || '',
      line: metaTagLine.value || '',
      place: metaTagPlace.value || ''
    }
  };
}

function updateMetaVisibility() {
  if (!metaPanel) return;
  metaPanel.classList.toggle('is-hidden', !metaEnabled);
}

function updateCardsList() {
  if (!cardsList) return;
  cardsList.innerHTML = '';
  if (!currentCards.length) {
    const empty = document.createElement('div');
    empty.className = 'tree__empty';
    empty.textContent = 'Карточек пока нет';
    cardsList.appendChild(empty);
    return;
  }
  currentCards.forEach((card) => {
    const item = document.createElement('div');
    item.className = 'card-item';
    const title = document.createElement('div');
    title.className = 'card-item__title';
    title.textContent = card.title || 'Без названия';
    const text = document.createElement('div');
    text.className = 'card-item__text';
    text.textContent = card.text || '';
    item.appendChild(title);
    item.appendChild(text);
    cardsList.appendChild(item);
  });
}

function getExpandedSet(tab) {
  if (expandedNodesByTab.has(tab)) {
    return expandedNodesByTab.get(tab);
  }
  let stored = [];
  try {
    stored = JSON.parse(
      readWorkspaceStorage(
        getTreeExpandedStorageKey(tab, currentProjectId),
        `treeExpanded:${tab}`
      ) || '[]'
    );
  } catch {
    stored = [];
  }
  const set = new Set(stored);
  expandedNodesByTab.set(tab, set);
  return set;
}

function saveExpandedSet(tab) {
  const set = expandedNodesByTab.get(tab);
  if (!set) return;
  try {
    localStorage.setItem(getTreeExpandedStorageKey(tab, currentProjectId), JSON.stringify(Array.from(set)));
  } catch {}
}

function getTitleFromPath(filePath) {
  if (!filePath) return '';
  const parts = filePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1] || '';
  return fileName.replace(/^\d+_/, '').replace(/\.txt$/i, '');
}

function getCategoryIndexDocumentPath(node) {
  if (!node || !node.path) return '';
  return `${node.path.replace(/[\\/]$/, '')}/.index.txt`;
}

function getEffectiveDocumentPath(node) {
  if (!node) return '';
  if (node.kind === 'materials-category' || node.kind === 'reference-category') {
    return getCategoryIndexDocumentPath(node);
  }
  return node.path || '';
}

function getEffectiveDocumentKind(node) {
  if (!node) return '';
  if (node.kind === 'materials-category') return 'material';
  if (node.kind === 'reference-category') return 'reference';
  return node.kind || '';
}

function clearContextMenu() {
  if (!contextMenu) return;
  contextMenu.innerHTML = '';
  contextMenu.hidden = true;
}

function showContextMenu(items, x, y) {
  if (!contextMenu) return;
  contextMenu.innerHTML = '';
  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'context-menu__item';
    button.textContent = item.label;
    button.addEventListener('click', () => {
      clearContextMenu();
      item.onClick();
    });
    contextMenu.appendChild(button);
  });
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.hidden = false;
}

function openCardModal(prefillText = '') {
  if (!cardModal || !cardTitleInput || !cardTextInput || !cardTagsInput) return;
  cardTitleInput.value = '';
  cardTextInput.value = prefillText || '';
  cardTagsInput.value = '';
  cardModal.hidden = false;
  cardTitleInput.focus();
}

function closeCardModal() {
  if (!cardModal) return;
  cardModal.hidden = true;
}

async function openDocumentNode(node) {
  const documentPath = getEffectiveDocumentPath(node);
  if (!documentPath) return false;
  const documentKind = getEffectiveDocumentKind(node);
  const state = await dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN, {
    path: documentPath,
    title: typeof node?.label === 'string' ? node.label : '',
    kind: documentKind,
  });
  if (!state.ok) {
    updateStatusText('Ошибка');
    return false;
  }
  const result = state.value && typeof state.value === 'object' && !Array.isArray(state.value)
    ? state.value.result
    : null;
  if (!result || result.opened !== true) {
    return false;
  }

  currentDocumentPath = documentPath;
  currentDocumentKind = documentKind;
  metaEnabled = currentDocumentKind === 'scene' || currentDocumentKind === 'chapter-file';
  updateMetaVisibility();
  updateInspectorSnapshot();
  return true;
}

async function handleCreateNode(node, kind, promptLabel) {
  const name = window.prompt(promptLabel || 'Название', '');
  if (!name) return;
  const parentPath = typeof node?.path === 'string' ? node.path.trim() : '';
  if (!parentPath || !kind) return;
  const state = await dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_CREATE_NODE, {
    parentPath,
    kind,
    name,
  });
  if (!state.ok) {
    updateStatusText('Ошибка');
    return;
  }
  await loadTree();
}

async function handleRenameNode(node) {
  const name = window.prompt('Новое имя', node.label || '');
  if (!name) return;
  const path = typeof node?.path === 'string' ? node.path.trim() : '';
  if (!path) return;
  const state = await dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_RENAME_NODE, { path, name });
  if (!state.ok) {
    updateStatusText('Ошибка');
    return;
  }
  const result = state.value && typeof state.value === 'object' && !Array.isArray(state.value)
    ? state.value.result
    : null;
  if (currentDocumentPath && result && typeof result.path === 'string' && currentDocumentPath === path) {
    currentDocumentPath = result.path;
  }
  await loadTree();
}

async function handleDeleteNode(node) {
  const confirmed = window.confirm('Переместить в корзину?');
  if (!confirmed) return;
  const path = typeof node?.path === 'string' ? node.path.trim() : '';
  if (!path) return;
  const state = await dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_DELETE_NODE, { path });
  if (!state.ok) {
    updateStatusText('Ошибка');
    return;
  }
  if (currentDocumentPath && currentDocumentPath === path) {
    currentDocumentPath = null;
  }
  await loadTree();
    if (!currentDocumentPath) {
      collapseSelection();
    }
    updateInspectorSnapshot();
}

async function handleReorderNode(node, direction) {
  const path = typeof node?.path === 'string' ? node.path.trim() : '';
  if (!path || (direction !== 'up' && direction !== 'down')) return;
  const state = await dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_REORDER_NODE, { path, direction });
  if (!state.ok) {
    return;
  }
  const result = state.value && typeof state.value === 'object' && !Array.isArray(state.value)
    ? state.value.result
    : null;
  if (currentDocumentPath && result && typeof result.path === 'string' && currentDocumentPath === path) {
    currentDocumentPath = result.path;
  }
  await loadTree();
}

function buildContextMenuItems(node) {
  const items = [];
  if (!node) return items;

  if (node.kind === 'part') {
    items.push({ label: 'Новая глава (документ)', onClick: () => handleCreateNode(node, 'chapter-file', 'Название главы') });
    items.push({ label: 'Новая глава (со сценами)', onClick: () => handleCreateNode(node, 'chapter-folder', 'Название главы') });
    items.push({ label: 'Вверх', onClick: () => handleReorderNode(node, 'up') });
    items.push({ label: 'Вниз', onClick: () => handleReorderNode(node, 'down') });
    items.push({ label: 'Переименовать', onClick: () => handleRenameNode(node) });
    items.push({ label: 'Удалить', onClick: () => handleDeleteNode(node) });
    return items;
  }

  if (node.kind === 'chapter-folder') {
    items.push({ label: 'Новая сцена', onClick: () => handleCreateNode(node, 'scene', 'Название сцены') });
    items.push({ label: 'Вверх', onClick: () => handleReorderNode(node, 'up') });
    items.push({ label: 'Вниз', onClick: () => handleReorderNode(node, 'down') });
    items.push({ label: 'Переименовать', onClick: () => handleRenameNode(node) });
    items.push({ label: 'Удалить', onClick: () => handleDeleteNode(node) });
    return items;
  }

  if (node.kind === 'chapter-file' || node.kind === 'scene') {
    items.push({ label: 'Добавить карточку…', onClick: async () => {
      const opened = await openDocumentNode(node);
      if (opened) openCardModal('');
    }});
    items.push({ label: 'Вверх', onClick: () => handleReorderNode(node, 'up') });
    items.push({ label: 'Вниз', onClick: () => handleReorderNode(node, 'down') });
    items.push({ label: 'Переименовать', onClick: () => handleRenameNode(node) });
    items.push({ label: 'Удалить', onClick: () => handleDeleteNode(node) });
    return items;
  }

  if (node.kind === 'materials-category' || node.kind === 'reference-category' || node.kind === 'folder') {
    if (node.kind === 'materials-category' || node.kind === 'reference-category') {
      items.push({
        label: 'Добавить карточку…',
        onClick: async () => {
          const opened = await openDocumentNode(node);
          if (opened) openCardModal('');
        }
      });
    }
    items.push({ label: 'Новая папка', onClick: () => handleCreateNode(node, 'folder', 'Название папки') });
    items.push({ label: 'Новый документ', onClick: () => handleCreateNode(node, 'file', 'Название документа') });
    if (node.kind === 'folder') {
      items.push({ label: 'Переименовать', onClick: () => handleRenameNode(node) });
      items.push({ label: 'Удалить', onClick: () => handleDeleteNode(node) });
    }
    return items;
  }

  if (node.kind === 'material' || node.kind === 'reference') {
    items.push({ label: 'Добавить карточку…', onClick: async () => {
      const opened = await openDocumentNode(node);
      if (opened) openCardModal('');
    }});
    items.push({ label: 'Переименовать', onClick: () => handleRenameNode(node) });
    items.push({ label: 'Удалить', onClick: () => handleDeleteNode(node) });
    return items;
  }

  return items;
}

function renderTreeNode(node, level, isLast, ancestorHasNext = []) {
  const li = document.createElement('li');
  li.className = 'tree__node';

  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'tree__row';
  row.dataset.level = String(level);

  const effectivePath = getEffectiveDocumentPath(node);
  if (currentDocumentPath && effectivePath && currentDocumentPath === effectivePath) {
    row.classList.add('is-selected');
  }

  const indent = document.createElement('span');
  indent.className = 'tree__indent';
  ancestorHasNext.forEach((hasNext) => {
    const guide = document.createElement('span');
    guide.className = 'tree__guide';
    if (hasNext) {
      guide.classList.add('is-active');
    }
    indent.appendChild(guide);
  });
  const currentGuide = document.createElement('span');
  currentGuide.className = 'tree__guide is-current';
  if (isLast) {
    currentGuide.classList.add('is-last');
  }
  indent.appendChild(currentGuide);
  row.appendChild(indent);

  const toggle = document.createElement('span');
  toggle.className = 'tree__toggle';
  const hasChildren = node.children && node.children.length > 0;
  if (hasChildren) {
    toggle.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4 10 8 6 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  const expandedSet = getExpandedSet(activeTab);
  const isExpanded =
    hasChildren &&
    (expandedSet.has(node.path) ||
      node.kind === 'materials-root' ||
      node.kind === 'reference-root' ||
      node.kind === 'materials-category' ||
      node.kind === 'reference-category');
  if (isExpanded) {
    toggle.classList.add('is-expanded');
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!hasChildren) return;
    if (expandedSet.has(node.path)) {
      expandedSet.delete(node.path);
    } else {
      expandedSet.add(node.path);
    }
    saveExpandedSet(activeTab);
    renderTree();
  });

  const label = document.createElement('span');
  label.className = 'tree__label';
  label.textContent = node.label || node.name || '';

  if (!hasChildren) {
    toggle.classList.add('is-empty');
  }
  row.appendChild(toggle);
  row.appendChild(label);
  row.addEventListener('click', async () => {
    if (
      hasChildren &&
      (node.kind === 'part' ||
        node.kind === 'chapter-folder' ||
        node.kind === 'folder' ||
        node.kind === 'roman-root' ||
        node.kind === 'roman-section-group' ||
        node.kind === 'mindmap-root' ||
        node.kind === 'print-root')
    ) {
      if (expandedSet.has(node.path)) {
        expandedSet.delete(node.path);
      } else {
        expandedSet.add(node.path);
      }
      saveExpandedSet(activeTab);
      renderTree();
      return;
    }
    if (
      node.path &&
      (node.kind === 'chapter-file' ||
        node.kind === 'scene' ||
        node.kind === 'material' ||
        node.kind === 'reference' ||
        node.kind === 'materials-category' ||
        node.kind === 'reference-category' ||
        node.kind === 'roman-section' ||
        node.kind === 'mindmap-section' ||
        node.kind === 'print-section')
    ) {
      const opened = await openDocumentNode(node);
      if (opened) {
        renderTree();
      }
    }
  });

  row.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const items = buildContextMenuItems(node);
    if (items.length) {
      showContextMenu(items, event.clientX, event.clientY);
    }
  });

  li.appendChild(row);

  if (hasChildren && isExpanded) {
    const ul = document.createElement('ul');
    ul.className = 'tree__children';
    node.children.forEach((child, index) => {
      ul.appendChild(
        renderTreeNode(
          child,
          level + 1,
          index === node.children.length - 1,
          ancestorHasNext.concat(!isLast)
        )
      );
    });
    li.appendChild(ul);
  }

  return li;
}

function findRomanRootNode(root) {
  if (!root) return null;
  if (root.kind === 'roman-root') return root;
  if (Array.isArray(root.children)) {
    return root.children.find((child) => child.kind === 'roman-root') || null;
  }
  return null;
}

function renderTree() {
  if (!treeContainer) return;
  treeContainer.innerHTML = '';
  if (!treeRoot) {
    const empty = document.createElement('div');
    empty.className = 'tree__empty';
    empty.textContent = 'Дерево пустое';
    treeContainer.appendChild(empty);
    renderOutlineList();
    renderSearchResults(leftSearchInput ? leftSearchInput.value : '');
    updateInspectorSnapshot();
    return;
  }
  const list = document.createElement('ul');
  list.className = 'tree__list';
  const nodesToRender =
    (treeRoot.kind === 'roman-root' ? [treeRoot] : treeRoot.children) || [];
  nodesToRender.forEach((child, index) => {
    list.appendChild(renderTreeNode(child, 0, index === nodesToRender.length - 1, []));
  });
  treeContainer.appendChild(list);
  renderOutlineList();
  renderSearchResults(leftSearchInput ? leftSearchInput.value : '');
  updateInspectorSnapshot();
}

async function loadTree() {
  if (!window.electronAPI || typeof window.electronAPI.invokeWorkspaceQueryBridge !== 'function') return;
  try {
    const result = await invokeWorkspaceQueryBridge('query.projectTree', { tab: activeTab });
    if (!result || result.ok === false) {
      updateStatusText('Ошибка');
      return;
    }
    treeRoot = result.root;
    if (treeContainer) {
      treeContainer.dataset.tab = activeTab;
    }
    if (activeTab === 'roman' && treeRoot) {
      const expandedSet = getExpandedSet(activeTab);
      let stored = null;
      stored = readWorkspaceStorage(
        getTreeExpandedStorageKey('roman', currentProjectId),
        'treeExpanded:roman'
      );
      if (stored === null) {
        const romanRoot = findRomanRootNode(treeRoot);
        const pathToExpand = (romanRoot && romanRoot.path) || treeRoot.path;
        if (pathToExpand) {
          expandedSet.add(pathToExpand);
          saveExpandedSet(activeTab);
        }
      }
    }
    renderTree();
  } catch {
    updateStatusText('Ошибка');
  }
}

if (treeContainer) {
  treeContainer.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.tree__row')) {
      return;
    }
    if (!treeRoot) return;
    event.preventDefault();
    if (activeTab === 'roman') {
      const romanRoot = findRomanRootNode(treeRoot);
      if (!romanRoot) return;
      showContextMenu(
        [
          {
            label: 'Новая часть',
            onClick: () => handleCreateNode(romanRoot, 'part', 'Название части')
          },
          {
            label: 'Новая глава (документ)',
            onClick: () => handleCreateNode(romanRoot, 'chapter-file', 'Название главы')
          },
          {
            label: 'Новая глава (со сценами)',
            onClick: () => handleCreateNode(romanRoot, 'chapter-folder', 'Название главы')
          }
        ],
        event.clientX,
        event.clientY
      );
    }
  });
}

let spatialResizeDragState = null;

function startSpatialResize(side, event) {
  const draftState = spatialLayoutState || getSpatialLayoutBaselineForViewport();
  spatialResizeDragState = {
    side,
    startX: event.clientX,
    startLeftWidth: draftState.leftSidebarWidth,
    startRightWidth: draftState.rightSidebarWidth,
  };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', handleSpatialResizeMove);
  window.addEventListener('pointerup', stopSpatialResize);
}

function handleSpatialResizeMove(event) {
  if (!spatialResizeDragState) return;
  const constraints = getSpatialLayoutConstraintsForViewport();
  const nextState = {
    ...(spatialLayoutState || getSpatialLayoutBaselineForViewport()),
    viewportWidth: getSpatialLayoutViewportWidth(),
    viewportMode: constraints.mode,
  };

  if (spatialResizeDragState.side === 'left') {
    nextState.leftSidebarWidth = clampSpatialSidebarWidth(
      spatialResizeDragState.startLeftWidth + (event.clientX - spatialResizeDragState.startX),
      constraints.leftMin,
      constraints.leftMax
    );
  } else {
    nextState.rightSidebarWidth = clampSpatialSidebarWidth(
      spatialResizeDragState.startRightWidth + (spatialResizeDragState.startX - event.clientX),
      constraints.rightMin,
      constraints.rightMax
    );
  }

  applySpatialLayoutState(nextState, { persist: false, projectId: currentProjectId });
  scheduleLayoutRefresh();
}

function stopSpatialResize() {
  if (!spatialResizeDragState) return;
  spatialResizeDragState = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('pointermove', handleSpatialResizeMove);
  window.removeEventListener('pointerup', stopSpatialResize);
  const committedLayoutState = commitSpatialLayoutState(currentProjectId);
  syncDesignOsDormantLayoutCommitAtResizeEnd(committedLayoutState);
  scheduleLayoutRefresh();
}

if (sidebar && sidebarResizer) {
  sidebarResizer.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startSpatialResize('left', event);
  });
}

if (rightSidebar && rightSidebarResizer) {
  rightSidebarResizer.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startSpatialResize('right', event);
  });
}

let localDirty = false;

if (metaSynopsis) {
  metaSynopsis.addEventListener('input', () => {
    syncMetaFromInputs();
    markAsModified();
  });
}

if (metaStatus) {
  metaStatus.addEventListener('change', () => {
    syncMetaFromInputs();
    markAsModified();
  });
}

if (metaTagPov) {
  metaTagPov.addEventListener('input', () => {
    syncMetaFromInputs();
    markAsModified();
  });
}

if (metaTagLine) {
  metaTagLine.addEventListener('input', () => {
    syncMetaFromInputs();
    markAsModified();
  });
}

if (metaTagPlace) {
  metaTagPlace.addEventListener('input', () => {
    syncMetaFromInputs();
    markAsModified();
  });
}

if (addCardButton) {
  addCardButton.addEventListener('click', () => {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_ADD_CARD);
  });
}

if (cardSaveButtons.length) {
  cardSaveButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!cardTitleInput || !cardTextInput || !cardTagsInput) return;
      const card = {
        title: cardTitleInput.value.trim(),
        text: cardTextInput.value.trim(),
        tags: cardTagsInput.value.trim()
      };
      currentCards.push(card);
      updateCardsList();
      markAsModified();
      closeCardModal();
    });
  });
}

if (cardCancelButtons.length) {
  cardCancelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closeCardModal();
    });
  });
}

document.addEventListener('click', (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget && !actionTarget.closest('[data-toolbar]')) {
    const action = actionTarget.dataset.action;
    if (handleUiAction(action)) {
      event.preventDefault();
      return;
    }
  }
  if (contextMenu && !contextMenu.hidden && !contextMenu.contains(event.target)) {
    clearContextMenu();
  }
});

document.addEventListener('contextmenu', (event) => {
  if (editor && editor.contains(event.target)) {
    event.preventDefault();
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString() : '';
    showContextMenu(
      [
        {
          label: 'Добавить карточку…',
          onClick: () => openCardModal(selectedText)
        }
      ],
      event.clientX,
      event.clientY
    );
  }
});

document.addEventListener('scroll', () => {
  clearContextMenu();
}, true);

function updateStatusText(text) {
  if (statusElement && text) {
    statusElement.textContent = buildStatusLineWithDormantYdosHint(text);
  }
}

function updateSaveStateText(text) {
  if (saveStateElement && text) {
    saveStateElement.textContent = `Save: ${text}`;
  }
}

function updateWarningStateText(text) {
  if (warningStateElement && text) {
    warningStateElement.textContent = `Warnings: ${text}`;
  }
}

function updatePerfHintText(text) {
  if (perfHintElement && text) {
    perfHintElement.textContent = `Perf: ${text}`;
  }
}

function buildStatusLineWithDormantYdosHint(text) {
  const baseText = String(text || '').trim();
  if (!baseText) return baseText;
  const context = buildDesignOsDormantContext();
  const profile = context.profile || 'BASELINE';
  const shellMode = context.shell_mode || 'CALM_DOCKED';
  const workspace = context.workspace || 'WRITE';
  const statusText = buildDesignOsStatusText({
    profile,
    shellMode,
    workspace,
  });
  const hint = designOsDormantRuntimeMount.lastError ? ' error' : ' dormant';
  const suffix = `[${statusText}${hint}]`;
  const normalizedBase = baseText.replace(/\s*\[YDOS [^\]]+\]$/u, '').trimEnd();
  return `${normalizedBase} ${suffix}`;
}

function buildDormantWarningHintText(text) {
  const baseText = String(text || '').trim();
  if (!baseText) return baseText;
  const hasDormantSignal = Boolean(designOsDormantRuntimeMount.lastError) || designOsDormantDegradedToBaseline === true;
  const normalizedBase = baseText.replace(/\s*\[YDOS dormant (?:error|degraded)\]$/u, '').trimEnd();
  if (!hasDormantSignal) return normalizedBase;
  const hint = designOsDormantRuntimeMount.lastError ? 'error' : 'degraded';
  return `${normalizedBase} [YDOS dormant ${hint}]`;
}

function buildDesignOsDormantObservabilityLines() {
  const context = buildDesignOsDormantContext();
  const lastError = typeof designOsDormantRuntimeMount.lastError === 'string' && designOsDormantRuntimeMount.lastError.trim()
    ? designOsDormantRuntimeMount.lastError
    : 'none';
  let resolverCalls = 0;
  let previewCalls = 0;
  let textInputEvents = 0;

  if (designOsDormantRuntimeMount.ports && typeof designOsDormantRuntimeMount.ports.getRuntimeSnapshot === 'function') {
    try {
      const runtimeSnapshot = designOsDormantRuntimeMount.ports.getRuntimeSnapshot();
      resolverCalls = Number.isFinite(runtimeSnapshot?.resolver_calls) ? runtimeSnapshot.resolver_calls : 0;
      previewCalls = Number.isFinite(runtimeSnapshot?.preview_calls) ? runtimeSnapshot.preview_calls : 0;
      textInputEvents = Number.isFinite(runtimeSnapshot?.text_input_events) ? runtimeSnapshot.text_input_events : 0;
    } catch {}
  }

  return [
    `YDOS_DormantMounted=${designOsDormantRuntimeMount.mounted ? 'true' : 'false'}`,
    `YDOS_DormantLastError=${lastError}`,
    `YDOS_Workspace=${context.workspace}`,
    `YDOS_Platform=${context.platform}`,
    `YDOS_Accessibility=${context.accessibility}`,
    `YDOS_ShellMode=${context.shell_mode}`,
    `YDOS_ResolverCalls=${resolverCalls}`,
    `YDOS_PreviewCalls=${previewCalls}`,
    `YDOS_TextInputEvents=${textInputEvents}`,
  ];
}

function updateInspectorSnapshot() {
  if (!inspectorSnapshotElement) return;
  const snapshot = [
    `Mode=${currentMode}`,
    `DocKind=${currentDocumentKind || 'none'}`,
    `DocPath=${currentDocumentPath || 'none'}`,
    `Dirty=${localDirty ? 'true' : 'false'}`,
    `FlowMode=${flowModeState.active ? 'active' : 'off'}`,
    `CollabScopeLocal=${collabScopeLocal ? 'true' : 'false'}`,
    ...buildDesignOsDormantObservabilityLines(),
  ];
  inspectorSnapshotElement.textContent = snapshot.join('\n');
}

function renderOutlineList() {
  if (!outlineListElement) return;
  outlineListElement.innerHTML = '';
  const items = [];
  if (treeRoot && Array.isArray(treeRoot.children)) {
    const walk = (nodes) => {
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const kind = String(node.kind || '');
        const isMindMap = kind === 'mindmap-section' || kind === 'mindmap-root';
        if (isMindMap && currentMode !== 'plan') {
          continue;
        }
        if (kind === 'part' || kind === 'chapter-folder' || kind === 'chapter-file' || kind === 'scene' || isMindMap) {
          items.push(`${kind}: ${node.label || ''}`);
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children);
        }
      }
    };
    walk(treeRoot.children);
  }
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tree__empty';
    empty.textContent = 'Outline is empty';
    outlineListElement.appendChild(empty);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'tree__list';
  for (const line of items) {
    const li = document.createElement('li');
    li.className = 'tree__node';
    li.textContent = line;
    list.appendChild(li);
  }
  outlineListElement.appendChild(list);
}

function renderSearchResults(query = '') {
  if (!searchResultsElement) return;
  searchResultsElement.innerHTML = '';
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) {
    const empty = document.createElement('div');
    empty.className = 'tree__empty';
    empty.textContent = 'Type to search';
    searchResultsElement.appendChild(empty);
    return;
  }
  const matches = [];
  const pushNode = (node) => {
    if (!node || typeof node !== 'object') return;
    const label = String(node.label || '');
    const kind = String(node.kind || '');
    if (label.toLowerCase().includes(needle)) {
      matches.push(`${kind}: ${label}`);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(pushNode);
    }
  };
  if (treeRoot && Array.isArray(treeRoot.children)) {
    treeRoot.children.forEach(pushNode);
  }
  const plain = getPlainText();
  if (plain.toLowerCase().includes(needle)) {
    matches.push('editor: text match');
  }
  if (matches.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tree__empty';
    empty.textContent = 'No matches';
    searchResultsElement.appendChild(empty);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'tree__list';
  for (const line of matches.slice(0, 100)) {
    const li = document.createElement('li');
    li.className = 'tree__node';
    li.textContent = line;
    list.appendChild(li);
  }
  searchResultsElement.appendChild(list);
}

function applyLeftTab(tab) {
  currentLeftTab = tab;
  for (const button of leftTabButtons) {
    const active = button.dataset.leftTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  if (treeContainer) treeContainer.hidden = tab !== 'project';
  if (outlineListElement) outlineListElement.hidden = tab !== 'outline';
  if (searchResultsElement) searchResultsElement.hidden = tab !== 'search';
  if (leftSearchPanel) leftSearchPanel.hidden = tab !== 'search';
  if (tab === 'outline') {
    renderOutlineList();
  }
  if (tab === 'search') {
    renderSearchResults(leftSearchInput ? leftSearchInput.value : '');
  }
}

function applyRightTab(tab) {
  currentRightTab = tab;
  for (const button of rightTabButtons) {
    const active = button.dataset.rightTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  if (rightInspectorPanel) rightInspectorPanel.hidden = tab !== 'inspector';
  if (rightSceneMetaPanel) rightSceneMetaPanel.hidden = tab !== 'scene-meta';
  if (rightCommentsPanel) rightCommentsPanel.hidden = tab !== 'comments' || !collabScopeLocal;
  if (rightHistoryPanel) rightHistoryPanel.hidden = tab !== 'history' || !collabScopeLocal;
}

function resolveDormantDesignOsProfileFromStyleValue(styleValue) {
  const normalized = typeof styleValue === 'string' ? styleValue.trim().toLowerCase() : '';
  if (normalized === 'focus') return 'FOCUS';
  return 'BASELINE';
}

function resolveDormantDesignOsShellModeFromLayoutMode(layoutMode) {
  const normalized = typeof layoutMode === 'string' ? layoutMode.trim().toLowerCase() : '';
  if (normalized === 'compact' || normalized === 'mobile') return 'COMPACT_DOCKED';
  return 'CALM_DOCKED';
}

function buildDesignOsDormantContext() {
  const styleValue = styleSelect && typeof styleSelect.value === 'string' ? styleSelect.value : '';
  const layoutMode = spatialLayoutState && typeof spatialLayoutState.viewportMode === 'string'
    ? spatialLayoutState.viewportMode
    : getSpatialLayoutMode();
  return {
    shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),
    profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),
    workspace: mapEditorModeToWorkspace(currentMode),
    platform: deriveRuntimePlatformId(),
    accessibility: deriveAccessibilityId(),
  };
}

function buildDesignOsDormantProductTruth() {
  const projectId = normalizeProjectId(currentProjectId) || 'local-project';
  const fallbackSceneId = 'scene-local';
  const fallbackText = getPlainText() || '';

  const buildSingleSceneFallbackTruth = () => ({
    project_id: projectId,
    active_scene_id: fallbackSceneId,
    scenes: {
      [fallbackSceneId]: fallbackText,
    },
  });

  const buildNonFlowDocumentTruth = () => {
    const hasPath = typeof currentDocumentPath === 'string' && currentDocumentPath.trim().length > 0;
    const hasKind = typeof currentDocumentKind === 'string' && currentDocumentKind.trim().length > 0;
    if (!hasPath || !hasKind) {
      return buildSingleSceneFallbackTruth();
    }
    const sceneId = currentDocumentPath.trim();
    return {
      project_id: projectId,
      active_scene_id: sceneId,
      scenes: {
        [sceneId]: fallbackText,
      },
    };
  };

  const buildFlowDocumentTruth = () => {
    if (!flowModeState.active) return null;
    const payload = buildFlowSavePayload(getPlainText(), flowModeState.scenes);
    if (!payload.ok || !Array.isArray(payload.scenes) || payload.scenes.length === 0) return null;
    const scenes = {};
    for (const scene of payload.scenes) {
      if (!scene || typeof scene !== 'object') continue;
      const scenePath = typeof scene.path === 'string' ? scene.path.trim() : '';
      if (!scenePath) continue;
      scenes[scenePath] = typeof scene.content === 'string' ? scene.content : '';
    }
    const activeSceneId = payload.scenes.find((scene) => scene && typeof scene.path === 'string' && scene.path.trim())
      ?.path
      ?.trim();
    if (!activeSceneId || Object.keys(scenes).length === 0) return null;
    return {
      project_id: projectId,
      active_scene_id: activeSceneId,
      scenes,
    };
  };

  const flowTruth = buildFlowDocumentTruth();
  if (flowTruth) {
    return flowTruth;
  }
  if (flowModeState.active) {
    return buildSingleSceneFallbackTruth();
  }
  return buildNonFlowDocumentTruth();
}

function buildDesignOsDormantTypographyDesignPatch() {
  if (!editor) return null;
  const computedStyle = window.getComputedStyle ? window.getComputedStyle(editor) : null;
  const fontFamily = (
    typeof editor.style.fontFamily === 'string' && editor.style.fontFamily.trim()
      ? editor.style.fontFamily.trim()
      : computedStyle && typeof computedStyle.fontFamily === 'string'
        ? computedStyle.fontFamily.trim()
        : ''
  );
  const lineHeightRaw = (
    typeof editor.style.lineHeight === 'string' && editor.style.lineHeight.trim()
      ? editor.style.lineHeight.trim()
      : computedStyle && typeof computedStyle.lineHeight === 'string'
        ? computedStyle.lineHeight.trim()
        : ''
  );
  const sizePx = Number(currentFontSizePx);
  const lineHeightValue = Number.parseFloat(lineHeightRaw);
  if (!fontFamily || !Number.isFinite(sizePx) || sizePx <= 0) return null;
  if (!Number.isFinite(lineHeightValue) || lineHeightValue <= 0) return null;
  return {
    typography: {
      font: {
        body: {
          family: fontFamily,
          sizePx: Number(sizePx.toFixed(2)),
        },
      },
      scale: {
        body: {
          lineHeight: Number(lineHeightValue.toFixed(3)),
        },
      },
    },
  };
}

function commitDesignOsDormantTypographyDesignPatch({ syncPreview = true } = {}) {
  if (!designOsDormantRuntimeMount.ports || typeof designOsDormantRuntimeMount.ports.commitDesign !== 'function') {
    return false;
  }
  const designPatch = buildDesignOsDormantTypographyDesignPatch();
  if (!designPatch) return false;
  try {
    designOsDormantRuntimeMount.ports.commitDesign({
      context: buildDesignOsDormantContext(),
      design_patch: designPatch,
      commit_point: 'apply',
    });
    if (syncPreview) {
      syncDesignOsDormantContext();
    }
    return true;
  } catch {
    return false;
  }
}

function buildDesignOsDormantThemeDesignPatch() {
  if (!document || !document.body) return null;
  const isDarkTheme = document.body.classList.contains('dark-theme');
  const computedStyle = window.getComputedStyle ? window.getComputedStyle(document.body) : null;
  const fallbackLight = {
    backgroundCanvas: '#e7e0d5',
    foregroundPrimary: '#171317',
    surfacePanel: '#fffdf8',
    surfaceElevated: '#e0d7c8',
    shellBackground: '#d8cfc1',
  };
  const fallbackDark = {
    backgroundCanvas: '#101119',
    foregroundPrimary: '#fdfdfd',
    surfacePanel: '#181a24',
    surfaceElevated: '#171925',
    shellBackground: '#11131d',
  };
  const fallbackTheme = isDarkTheme ? fallbackDark : fallbackLight;
  const resolveToken = (cssVarName, fallbackValue) => {
    const rawValue = computedStyle && typeof computedStyle.getPropertyValue === 'function'
      ? computedStyle.getPropertyValue(cssVarName)
      : '';
    const normalized = typeof rawValue === 'string' ? rawValue.trim() : '';
    return normalized || fallbackValue;
  };
  const backgroundCanvas = resolveToken('--background', fallbackTheme.backgroundCanvas);
  const foregroundPrimary = resolveToken('--foreground', fallbackTheme.foregroundPrimary);
  const surfacePanel = resolveToken('--card', fallbackTheme.surfacePanel);
  const surfaceElevated = resolveToken('--sidebar', fallbackTheme.surfaceElevated);
  const shellBackground = resolveToken('--canvas-bg', fallbackTheme.shellBackground);
  return {
    color: {
      background: {
        canvas: backgroundCanvas,
      },
      text: {
        primary: foregroundPrimary,
      },
      surface: {
        panel: surfacePanel,
        elevated: surfaceElevated,
      },
    },
    surface: {
      shell: {
        background: shellBackground,
      },
      editor: {
        background: surfacePanel,
      },
    },
  };
}

function commitDesignOsDormantThemeDesignPatch({ syncPreview = true } = {}) {
  if (!designOsDormantRuntimeMount.ports || typeof designOsDormantRuntimeMount.ports.commitDesign !== 'function') {
    return false;
  }
  const designPatch = buildDesignOsDormantThemeDesignPatch();
  if (!designPatch) return false;
  try {
    designOsDormantRuntimeMount.ports.commitDesign({
      context: buildDesignOsDormantContext(),
      design_patch: designPatch,
      commit_point: 'mode_switch',
    });
    if (syncPreview) {
      syncDesignOsDormantContext();
    }
    return true;
  } catch {
    return false;
  }
}

function replayDesignOsDormantDesignStateAfterSafeReset() {
  commitDesignOsDormantTypographyDesignPatch({ syncPreview: false });
  commitDesignOsDormantThemeDesignPatch({ syncPreview: false });
  syncDesignOsDormantContext();
}

function remountDesignOsDormantRuntimeForCurrentDocumentContext(options = {}) {
  try {
    const productTruth = options && typeof options === 'object' && options.productTruth
      ? options.productTruth
      : buildDesignOsDormantProductTruth();
    const productTruthHash = options && typeof options === 'object' && typeof options.productTruthHash === 'string' && options.productTruthHash
      ? options.productTruthHash
      : buildProductTruthHash(productTruth);
    const bootstrap = createRepoGroundedDesignOsBrowserRuntime({
      productTruth,
    });
    const ports = createDesignOsPorts({
      runtime: bootstrap.runtime,
      defaultContext: buildDesignOsDormantContext(),
    });
    designOsDormantRuntimeMount = {
      mounted: true,
      runtime: bootstrap.runtime,
      ports,
      bootstrap,
      lastError: null,
    };
    designOsDormantDegradedToBaseline = false;
    designOsDormantVisibleCommandIds = null;
    designOsDormantLastSyncedProductTruthHash = productTruthHash;
    const layoutStateForReplay = spatialLayoutState || getSpatialLayoutBaselineForViewport();
    syncDesignOsDormantLayoutCommitAtResizeEnd(layoutStateForReplay);
    commitDesignOsDormantTypographyDesignPatch({ syncPreview: false });
    commitDesignOsDormantThemeDesignPatch({ syncPreview: false });
    syncDesignOsDormantContext();
  } catch (error) {
    designOsDormantRuntimeMount = {
      mounted: false,
      runtime: null,
      ports: null,
      bootstrap: null,
      lastError: error instanceof Error ? error.message : String(error),
    };
    designOsDormantDegradedToBaseline = false;
    designOsDormantVisibleCommandIds = null;
  }
  return {
    ...designOsDormantRuntimeMount,
  };
}

function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {
  if (!previousDirtyState || nextDirtyState) return;
  const productTruth = buildDesignOsDormantProductTruth();
  let productTruthHash = null;
  try {
    productTruthHash = buildProductTruthHash(productTruth);
  } catch {
    return;
  }
  if (typeof productTruthHash !== 'string' || productTruthHash.length === 0) return;
  if (productTruthHash === designOsDormantLastSyncedProductTruthHash) return;
  remountDesignOsDormantRuntimeForCurrentDocumentContext({
    productTruth,
    productTruthHash,
  });
}

function mountDesignOsDormantRuntime() {
  if (designOsDormantRuntimeMount.mounted) {
    return designOsDormantRuntimeMount;
  }
  return remountDesignOsDormantRuntimeForCurrentDocumentContext();
}

function syncDesignOsDormantContext() {
  if (!designOsDormantRuntimeMount.ports) return;
  try {
    const preview = designOsDormantRuntimeMount.ports.previewDesign({
      context: buildDesignOsDormantContext(),
    });
    designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;
    const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);
    designOsDormantVisibleCommandIds = nextVisibleCommandIds;
    const resolvedTokens = preview?.resolved_tokens;
    if (resolvedTokens && typeof resolvedTokens === 'object') {
      const isDarkTheme = document.body.classList.contains('dark-theme');
      const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {
        isDarkTheme,
      });
      applyCssVariables(document.documentElement, cssVariables);
    }
  } catch {
    designOsDormantVisibleCommandIds = null;
  }
}

function syncDesignOsDormantTextInput() {
  if (!designOsDormantRuntimeMount.ports) return;
  try {
    designOsDormantRuntimeMount.ports.onTextInput(getPlainText());
  } catch {}
}

function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState) {
  if (!committedSpatialState) return;
  if (!designOsDormantRuntimeMount.ports || typeof designOsDormantRuntimeMount.ports.commitDesign !== 'function') return;
  try {
    const context = buildDesignOsDormantContext();
    const layoutPatch = buildLayoutPatchFromSpatialState(committedSpatialState, {
      viewportWidth: committedSpatialState.viewportWidth || getSpatialLayoutViewportWidth(),
      viewportHeight: Math.max(320, Math.floor(Number(window.innerHeight) || 0) || 900),
      shellMode: context.shell_mode || 'CALM_DOCKED',
    });
    designOsDormantRuntimeMount.ports.commitDesign({
      context,
      layout_patch: layoutPatch,
      commit_point: 'resize_end',
    });
  } catch {}
}

function applyMode(mode) {
  currentMode = mode;
  document.body.dataset.mode = mode;
  for (const button of modeButtons) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  if (mode === 'plan') {
    applyLeftTab('outline');
  } else if (mode === 'review') {
    applyRightTab(collabScopeLocal ? 'comments' : 'inspector');
  } else {
    applyLeftTab('project');
    applyRightTab('inspector');
  }
  syncDesignOsDormantContext();
  updateInspectorSnapshot();
}

function resolveSafeResetFontFamily() {
  if (fontSelect) {
    const hasPreferredOption = Array.from(fontSelect.options).some((option) => option.value === SAFE_RESET_BASELINE_FONT_FAMILY);
    if (hasPreferredOption) {
      return SAFE_RESET_BASELINE_FONT_FAMILY;
    }
    if (typeof fontSelect.value === 'string' && fontSelect.value.trim()) {
      return fontSelect.value;
    }
  }
  return SAFE_RESET_BASELINE_FONT_FAMILY;
}

function clearProjectWorkspaceStorage(projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const keysToRemove = new Set([
    'activeDocumentTitle',
    'spatialLayout',
    ...PROJECT_WORKSPACE_RESET_TABS.map((tab) => `treeExpanded:${tab}`),
  ]);

  if (normalizedProjectId) {
    keysToRemove.add(getActiveDocumentTitleStorageKey(normalizedProjectId));
    keysToRemove.add(getSpatialLayoutStorageKey(normalizedProjectId));
    keysToRemove.add(getSpatialLastStableLayoutStorageKey(normalizedProjectId));
    PROJECT_WORKSPACE_RESET_TABS.forEach((tab) => {
      keysToRemove.add(getTreeExpandedStorageKey(tab, normalizedProjectId));
    });
  }

  try {
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    if (normalizedProjectId) {
      const prefixedKeys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (typeof key === 'string' && key.startsWith(`treeExpanded:${normalizedProjectId}:`)) {
          prefixedKeys.push(key);
        }
      }
      prefixedKeys.forEach((key) => localStorage.removeItem(key));
    }
  } catch {}

  expandedNodesByTab = new Map();
}

function performSafeResetShell() {
  const nextFontFamily = resolveSafeResetFontFamily();

  clearProjectWorkspaceStorage(currentProjectId);

  try {
    localStorage.removeItem('editorTheme');
    localStorage.removeItem('editorFont');
    localStorage.removeItem('editorFontWeight');
    localStorage.removeItem('editorLineHeight');
    localStorage.removeItem('editorWordWrap');
    localStorage.removeItem('editorViewMode');
    localStorage.removeItem(EDITOR_ZOOM_STORAGE_KEY);
    localStorage.removeItem(FLOATING_TOOLBAR_STORAGE_KEY);
    localStorage.removeItem(FLOATING_TOOLBAR_ITEM_OFFSETS_STORAGE_KEY);
    localStorage.removeItem(LEFT_FLOATING_TOOLBAR_STORAGE_KEY);
    localStorage.removeItem(LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY);
    localStorage.removeItem(CONFIGURATOR_BUCKETS_STORAGE_KEY);
  } catch {}

  applyTheme(SAFE_RESET_BASELINE_THEME);
  if (settingsThemeSelect) {
    settingsThemeSelect.value = SAFE_RESET_BASELINE_THEME;
  }

  if (fontSelect) {
    ensureSelectHasOption(fontSelect, nextFontFamily, 'Roboto Ms');
    fontSelect.value = nextFontFamily;
  }
  applyFont(nextFontFamily);

  if (weightSelect) {
    weightSelect.value = SAFE_RESET_BASELINE_FONT_WEIGHT;
  }
  applyFontWeight(SAFE_RESET_BASELINE_FONT_WEIGHT);

  if (lineHeightSelect) {
    ensureSelectHasOption(lineHeightSelect, SAFE_RESET_BASELINE_LINE_HEIGHT, SAFE_RESET_BASELINE_LINE_HEIGHT, '__custom_line_height__');
    lineHeightSelect.value = SAFE_RESET_BASELINE_LINE_HEIGHT;
  }
  applyLineHeight(SAFE_RESET_BASELINE_LINE_HEIGHT);

  applyWordWrap(true);
  if (settingsWrapSelect) {
    settingsWrapSelect.value = 'on';
  }
  applyViewMode(SAFE_RESET_BASELINE_VIEW_MODE);
  setEditorZoom(EDITOR_ZOOM_DEFAULT);
  setToolbarCompactMode(false);
  let nextSafeResetLayoutState = null;
  let safeResetPortSucceeded = false;
  if (designOsDormantRuntimeMount.ports && typeof designOsDormantRuntimeMount.ports.safeResetShell === 'function') {
    try {
      const layoutSnapshot = designOsDormantRuntimeMount.ports.safeResetShell();
      nextSafeResetLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {
        viewportWidth: getSpatialLayoutViewportWidth(),
      });
      designOsDormantDegradedToBaseline = false;
      safeResetPortSucceeded = true;
    } catch {}
  }
  applySpatialLayoutState(nextSafeResetLayoutState || getSpatialLayoutBaselineForViewport(), {
    persist: true,
    projectId: currentProjectId,
  });
  persistSpatialLastStableLayoutState(spatialLayoutState, currentProjectId);
  commitSpatialLayoutState(currentProjectId);

  if (editor) {
    editor.style.fontSize = `${SAFE_RESET_BASELINE_FONT_SIZE_PX}px`;
  }
  setCurrentFontSize(SAFE_RESET_BASELINE_FONT_SIZE_PX);
  window.electronAPI?.setFontSizePx(SAFE_RESET_BASELINE_FONT_SIZE_PX);

  toolbarItemOffsets = {};
  persistFloatingToolbarItemOffsets();
  applyFloatingToolbarState(getDefaultFloatingToolbarState(), true);

  leftToolbarButtonOffsets = {};
  persistLeftToolbarButtonOffsets();
  applyLeftFloatingToolbarState(getDefaultLeftFloatingToolbarState(), true);

  configuratorBucketState = { master: [], minimal: [] };
  setActiveConfiguratorBucketSelection('', -1);
  persistConfiguratorBucketState();
  renderConfiguratorBuckets();
  setConfiguratorOpen(false);
  setToolbarSpacingTuningMode(false);
  setToolbarSpacingMenuOpen(false);
  setLeftToolbarSpacingTuningMode(false);
  setLeftToolbarSpacingMenuOpen(false);

  if (leftSearchInput) {
    leftSearchInput.value = '';
    renderSearchResults('');
  }

  closeSimpleModal(settingsModal);
  closeSimpleModal(recoveryModal);
  closeSimpleModal(exportPreviewModal);
  closeSimpleModal(diagnosticsModal);

  applyMode('write');
  if (safeResetPortSucceeded) {
    replayDesignOsDormantDesignStateAfterSafeReset();
  }
  applyLeftTab('project');
  applyRightTab('inspector');
  loadTree();
  updateWordCount();
  updateSaveStateText(localDirty ? 'unsaved' : 'idle');
  updateWarningStateText(buildDormantWarningHintText('none'));
  updatePerfHintText('normal');
  updateStatusText('Shell reset to baseline');
  updateInspectorSnapshot();

  return { performed: true, action: 'safe-reset-shell', reason: null };
}

function performRestoreLastStableShell() {
  const savedActiveDocumentTitle = String(
    readWorkspaceStorage(getActiveDocumentTitleStorageKey(currentProjectId), 'activeDocumentTitle') || ''
  ).trim();

  loadSavedTheme();
  if (settingsThemeSelect) {
    settingsThemeSelect.value = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
  }

  loadSavedFont();
  loadSavedFontWeight();
  loadSavedLineHeight();
  loadSavedWordWrap();
  if (settingsWrapSelect) {
    settingsWrapSelect.value = wordWrapEnabled ? 'on' : 'off';
  }
  loadSavedViewMode();
  loadSavedEditorZoom();

  const restoredFontSizePx = Number.isFinite(currentFontSizePx)
    ? currentFontSizePx
    : SAFE_RESET_BASELINE_FONT_SIZE_PX;
  if (editor) {
    editor.style.fontSize = `${restoredFontSizePx}px`;
  }
  setCurrentFontSize(restoredFontSizePx);
  window.electronAPI?.setFontSizePx(restoredFontSizePx);

  restoreFloatingToolbarItemOffsets();
  restoreFloatingToolbarPosition();
  restoreLeftToolbarButtonOffsets();
  restoreLeftFloatingToolbarPosition();
  let nextRestoreLayoutState = null;
  if (designOsDormantRuntimeMount.ports && typeof designOsDormantRuntimeMount.ports.restoreLastStableShell === 'function') {
    try {
      const layoutSnapshot = designOsDormantRuntimeMount.ports.restoreLastStableShell();
      nextRestoreLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {
        viewportWidth: getSpatialLayoutViewportWidth(),
      });
      designOsDormantDegradedToBaseline = false;
    } catch {}
  }
  if (nextRestoreLayoutState) {
    applySpatialLayoutState(nextRestoreLayoutState, {
      persist: false,
      projectId: currentProjectId,
    });
  } else {
    restoreSpatialLayoutState(currentProjectId);
    restoreLastStableSpatialLayoutState(currentProjectId);
  }
  syncDesignOsDormantContext();

  configuratorBucketState = readConfiguratorBucketState();
  setActiveConfiguratorBucketSelection('', -1);
  renderConfiguratorBuckets();
  setConfiguratorOpen(false);
  setToolbarSpacingTuningMode(false);
  setToolbarSpacingMenuOpen(false);
  setLeftToolbarSpacingTuningMode(false);
  setLeftToolbarSpacingMenuOpen(false);

  expandedNodesByTab = new Map();
  renderTree();
  if (leftSearchInput && currentLeftTab === 'search') {
    renderSearchResults(leftSearchInput.value);
  }

  closeSimpleModal(settingsModal);
  closeSimpleModal(recoveryModal);
  closeSimpleModal(exportPreviewModal);
  closeSimpleModal(diagnosticsModal);

  updateWordCount();
  updateSaveStateText(localDirty ? 'unsaved' : 'idle');
  updateWarningStateText(buildDormantWarningHintText('recovery restored'));
  updatePerfHintText('normal');
  updateStatusText(
    savedActiveDocumentTitle
      ? `Restored last stable shell state for ${savedActiveDocumentTitle}`
      : 'Restored last stable shell state'
  );
  updateInspectorSnapshot();

  return { performed: true, action: 'restore-last-stable-shell', reason: null };
}

function openSimpleModal(modal) {
  if (!modal) return;
  modal.hidden = false;
}

function closeSimpleModal(modal) {
  if (!modal) return;
  modal.hidden = true;
}

function openSettingsModal() {
  if (settingsThemeSelect) {
    settingsThemeSelect.value = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
  }
  if (settingsWrapSelect) {
    settingsWrapSelect.value = wordWrapEnabled ? 'on' : 'off';
  }
  openSimpleModal(settingsModal);
}

function openRecoveryModal(message = '') {
  if (recoveryMessage) {
    recoveryMessage.textContent = message || 'Recovery ready';
  }
  openSimpleModal(recoveryModal);
}

function openDiagnosticsModal() {
  if (diagnosticsText) {
    const lines = [
      `mode=${currentMode}`,
      `leftTab=${currentLeftTab}`,
      `rightTab=${currentRightTab}`,
      `docKind=${currentDocumentKind || 'none'}`,
      `docPath=${currentDocumentPath || 'none'}`,
      `dirty=${localDirty ? 'true' : 'false'}`,
      `flowModeActive=${flowModeState.active ? 'true' : 'false'}`,
      `collabScopeLocal=${collabScopeLocal ? 'true' : 'false'}`,
      ...buildDesignOsDormantObservabilityLines(),
    ];
    diagnosticsText.value = lines.join('\n');
  }
  openSimpleModal(diagnosticsModal);
}

function openExportPreviewModal() {
  if (exportPreviewMessage) {
    exportPreviewMessage.textContent = 'DOCX baseline export. Confirm to continue.';
  }
  openSimpleModal(exportPreviewModal);
}

async function confirmExportPreviewAndRun() {
  closeSimpleModal(exportPreviewModal);
  updatePerfHintText('export');
  await dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);
  updatePerfHintText('normal');
  updateWarningStateText(buildDormantWarningHintText('none'));
}

function applyCollabGate() {
  for (const button of rightTabButtons) {
    const tab = button.dataset.rightTab;
    const gated = tab === 'comments' || tab === 'history';
    if (gated) {
      button.hidden = !collabScopeLocal;
    }
  }
  if (!collabScopeLocal && (currentRightTab === 'comments' || currentRightTab === 'history')) {
    applyRightTab('inspector');
  } else {
    applyRightTab(currentRightTab);
  }
  updateInspectorSnapshot();
}

async function initializeCollabScopeLocal() {
  try {
    if (window.electronAPI && typeof window.electronAPI.invokeWorkspaceQueryBridge === 'function') {
      collabScopeLocal = (await invokeWorkspaceQueryBridge('query.collabScopeLocal')) === true;
    } else {
      collabScopeLocal = localStorage.getItem('COLLAB_SCOPE_LOCAL') === 'true';
    }
  } catch {
    collabScopeLocal = false;
  }
  applyCollabGate();
}

function installNetworkGuard() {
  const blockedError = () => new Error('E_COLLAB_TRANSPORT_FORBIDDEN_IN_MVP');
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async (...args) => {
      const url = String(args[0] || '');
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ws://') || url.startsWith('wss://')) {
        updateWarningStateText(buildDormantWarningHintText('network blocked before X4'));
        throw blockedError();
      }
      return originalFetch(...args);
    };
  }
}

function updateWordCount() {
  if (!editor || !wordCountElement) return;
  const text = getPlainText();
  const trimmed = text.trim();
  const count = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  wordCountElement.textContent = `${count} words`;
  if (count > 20000) {
    updatePerfHintText('large document');
  }
}

function updateZoomValue() {
  if (!zoomValueElement) return;
  const percent = Math.round(editorZoom * 100);
  zoomValueElement.textContent = `${percent}%`;
}

function setEditorZoom(value, persist = true) {
  const quantized = Math.round(value / EDITOR_ZOOM_STEP) * EDITOR_ZOOM_STEP;
  const nextZoom = Math.max(EDITOR_ZOOM_MIN, Math.min(EDITOR_ZOOM_MAX, quantized));
  editorZoom = nextZoom;
  const metrics = getPageMetrics({ pageWidthMm: initialPageWidthMm, zoom: editorZoom });
  applyPageViewCssVars(metrics);
  updateZoomValue();
  if (!persist) {
    return;
  }

  try {
    localStorage.setItem(EDITOR_ZOOM_STORAGE_KEY, String(editorZoom));
  } catch {}
}

function changeEditorZoom(delta) {
  setEditorZoom(editorZoom + delta);
}

function loadSavedEditorZoom() {
  try {
    const saved = Number(localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY));
    if (Number.isFinite(saved)) {
      setEditorZoom(saved, false);
      return;
    }
  } catch {}

  setEditorZoom(EDITOR_ZOOM_DEFAULT, false);
}

function setCurrentFontSize(px) {
  if (!Number.isFinite(px)) return;
  currentFontSizePx = px;
  if (sizeSelect) {
    sizeSelect.value = String(px);
  }
}

function promptForCustomFontSize() {
  if (typeof window.prompt !== 'function') return null;
  const raw = window.prompt('Font size (8-96)', String(currentFontSizePx || 16));
  if (raw === null) return null;
  const px = Number(String(raw).trim());
  if (!Number.isFinite(px) || px < 8 || px > 96) return null;
  return px;
}

function scheduleAutoSave(delay = AUTO_SAVE_DELAY) {
  if (!window.electronAPI || typeof window.electronAPI.invokeSaveLifecycleSignalBridge !== 'function') {
    return;
  }

  if (autoSaveTimerId) {
    clearTimeout(autoSaveTimerId);
  }

  autoSaveTimerId = window.setTimeout(() => {
    invokeSaveLifecycleSignalBridge('signal.autoSave.request')
      .finally(() => {
        autoSaveTimerId = null;
      });
  }, delay);
}

function markAsModified() {
  if (flowModeState.active) {
    flowModeState = {
      ...flowModeState,
      dirty: true,
    };
    updateStatusText(buildFlowModeCoreStatus(flowModeState.scenes.length, { dirty: true }));
  } else {
    updateStatusText('Изменено');
  }

  if (!localDirty) {
    localDirty = true;
    void invokeSaveLifecycleSignalBridge('signal.localDirty.set', { state: true });
  }
  updateSaveStateText('unsaved');
  updatePerfHintText('typing');
  updateInspectorSnapshot();
  scheduleAutoSave();
}

function getDefaultFloatingToolbarState() {
  return {
    position: { x: 0, y: 0 },
    compact: false,
    scale: 1,
    widthScale: 1,
  };
}

function normalizeFloatingToolbarState(input) {
  const fallback = getDefaultFloatingToolbarState();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fallback;
  }
  const position = input.position && typeof input.position === 'object' && !Array.isArray(input.position)
    ? input.position
    : {};
  const x = Number(position.x);
  const y = Number(position.y);
  const scale = Number(input.scale);
  const widthScale = Number(input.widthScale);
  return {
    position: {
      x: Number.isFinite(x) ? x : fallback.position.x,
      y: Number.isFinite(y) ? y : fallback.position.y,
    },
    compact: Boolean(input.compact),
    scale: Number.isFinite(scale) ? Math.min(FLOATING_TOOLBAR_SCALE_MAX, Math.max(FLOATING_TOOLBAR_SCALE_MIN, scale)) : fallback.scale,
    widthScale: Number.isFinite(widthScale)
      ? Math.min(FLOATING_TOOLBAR_WIDTH_SCALE_MAX, Math.max(FLOATING_TOOLBAR_WIDTH_SCALE_MIN, widthScale))
      : fallback.widthScale,
  };
}

function readFloatingToolbarState() {
  try {
    const raw = localStorage.getItem(FLOATING_TOOLBAR_STORAGE_KEY);
    if (!raw) return getDefaultFloatingToolbarState();
    return normalizeFloatingToolbarState(JSON.parse(raw));
  } catch (error) {
    return getDefaultFloatingToolbarState();
  }
}

function persistFloatingToolbarState() {
  localStorage.setItem(FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(floatingToolbarState));
}

function readFloatingToolbarItemOffsets() {
  try {
    const raw = localStorage.getItem(FLOATING_TOOLBAR_ITEM_OFFSETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function persistFloatingToolbarItemOffsets() {
  localStorage.setItem(FLOATING_TOOLBAR_ITEM_OFFSETS_STORAGE_KEY, JSON.stringify(toolbarItemOffsets));
}

function applyFloatingToolbarState(nextState, persist = true) {
  floatingToolbarState = normalizeFloatingToolbarState(nextState);
  setToolbarCompactMode(floatingToolbarState.compact);
  if (persist) {
    persistFloatingToolbarState();
  }
}

function restoreFloatingToolbarItemOffsets() {
  toolbarItemOffsets = readFloatingToolbarItemOffsets();
}

function restoreFloatingToolbarPosition() {
  applyFloatingToolbarState(readFloatingToolbarState(), false);
}

function getDefaultLeftFloatingToolbarState() {
  return {
    position: { x: 0, y: 0 },
    compact: false,
  };
}

function normalizeLeftFloatingToolbarState(input) {
  const fallback = getDefaultLeftFloatingToolbarState();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fallback;
  }
  const position = input.position && typeof input.position === 'object' && !Array.isArray(input.position)
    ? input.position
    : {};
  const x = Number(position.x);
  const y = Number(position.y);
  return {
    position: {
      x: Number.isFinite(x) ? x : fallback.position.x,
      y: Number.isFinite(y) ? y : fallback.position.y,
    },
    compact: Boolean(input.compact),
  };
}

function readLeftFloatingToolbarState() {
  try {
    const raw = localStorage.getItem(LEFT_FLOATING_TOOLBAR_STORAGE_KEY);
    if (!raw) return getDefaultLeftFloatingToolbarState();
    return normalizeLeftFloatingToolbarState(JSON.parse(raw));
  } catch (error) {
    return getDefaultLeftFloatingToolbarState();
  }
}

function persistLeftFloatingToolbarState() {
  localStorage.setItem(LEFT_FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(leftFloatingToolbarState));
}

function readLeftToolbarButtonOffsets() {
  try {
    const raw = localStorage.getItem(LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function persistLeftToolbarButtonOffsets() {
  localStorage.setItem(LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY, JSON.stringify(leftToolbarButtonOffsets));
}

function applyLeftFloatingToolbarState(nextState, persist = true) {
  leftFloatingToolbarState = normalizeLeftFloatingToolbarState(nextState);
  if (persist) {
    persistLeftFloatingToolbarState();
  }
}

function restoreLeftToolbarButtonOffsets() {
  leftToolbarButtonOffsets = readLeftToolbarButtonOffsets();
}

function restoreLeftFloatingToolbarPosition() {
  applyLeftFloatingToolbarState(readLeftFloatingToolbarState(), false);
}

function readConfiguratorBucketState() {
  try {
    const raw = localStorage.getItem(CONFIGURATOR_BUCKETS_STORAGE_KEY);
    if (!raw) return { master: [], minimal: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { master: [], minimal: [] };
    }
    return {
      master: Array.isArray(parsed.master) ? parsed.master : [],
      minimal: Array.isArray(parsed.minimal) ? parsed.minimal : [],
    };
  } catch (error) {
    return { master: [], minimal: [] };
  }
}

function persistConfiguratorBucketState() {
  localStorage.setItem(CONFIGURATOR_BUCKETS_STORAGE_KEY, JSON.stringify(configuratorBucketState));
}

function setActiveConfiguratorBucketSelection() {}

function renderConfiguratorBuckets() {}

function setConfiguratorOpen() {}

function setToolbarSpacingTuningMode() {}

function setToolbarSpacingMenuOpen() {}

function setLeftToolbarSpacingTuningMode() {}

function setLeftToolbarSpacingMenuOpen() {}

function resolveFontWeightPresetId(weight) {
  const normalized = String(weight || '').trim();
  if (Object.prototype.hasOwnProperty.call(FONT_WEIGHT_PRESETS, normalized)) {
    return normalized;
  }
  return LEGACY_FONT_WEIGHT_PRESET_MAP[normalized] || 'regular';
}

function getWeightSelectValueForPresetId(presetId) {
  const preset = FONT_WEIGHT_PRESETS[presetId] || FONT_WEIGHT_PRESETS.regular;
  return preset.weight;
}

function applyFontWeight(weight, persist = true) {
  if (!editor) return;
  const presetId = resolveFontWeightPresetId(weight);
  const preset = FONT_WEIGHT_PRESETS[presetId] || FONT_WEIGHT_PRESETS.regular;
  editor.style.fontWeight = preset.weight;
  editor.style.fontStretch = preset.stretch;
  editor.style.letterSpacing = preset.spacing;
  if (weightSelect) {
    weightSelect.value = getWeightSelectValueForPresetId(presetId);
  }
  if (persist) {
    localStorage.setItem('editorFontWeight', presetId);
  }
  renderStyledView(getPlainText());
}

function applyLineHeight(value, persist = true) {
  if (!editor) return;
  editor.style.lineHeight = String(value);
  if (lineHeightSelect) {
    lineHeightSelect.value = String(value);
  }
  if (persist) {
    localStorage.setItem('editorLineHeight', String(value));
  }
  renderStyledView(getPlainText());
  commitDesignOsDormantTypographyDesignPatch();
}

function applyWordWrap(enabled, persist = true) {
  if (!editor) return;
  wordWrapEnabled = enabled;
  editor.style.whiteSpace = enabled ? 'pre-wrap' : 'pre';
  editor.style.overflowX = enabled ? 'hidden' : 'auto';
  if (wrapToggleButton) {
    wrapToggleButton.classList.toggle('is-active', enabled);
    wrapToggleButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  if (persist) {
    localStorage.setItem('editorWordWrap', enabled ? 'on' : 'off');
  }
  updateInspectorSnapshot();
}

function applyViewMode(mode, persist = true) {
  const isFocus = mode === 'focus';
  document.body.classList.toggle('focus-mode', isFocus);
  if (styleSelect) {
    styleSelect.value = mode;
  }
  if (persist) {
    localStorage.setItem('editorViewMode', mode);
  }
  syncDesignOsDormantContext();
}

function applyTextStyle(action) {
  if (!editor || !action) return;
  const text = getPlainText();
  const { start: rawStart, end: rawEnd } = getSelectionOffsets();
  const boundedStart = Math.max(0, Math.min(rawStart, rawEnd));
  const boundedEnd = Math.max(0, Math.max(rawStart, rawEnd));
  const start = Math.min(boundedStart, text.length);
  const end = Math.min(boundedEnd, text.length);
  let result = null;

  if (action.startsWith('paragraph-')) {
    result = applyParagraphStyle(text, start, end, action);
  } else if (action.startsWith('character-')) {
    result = applyCharacterStyle(text, start, end, action);
  }

  if (!result) return;
  setPlainText(result.newText);
  setSelectionRange(result.newStart, result.newEnd);
  markAsModified();
  updateWordCount();
}

function updateAlignmentButtons(activeAction) {
  if (!alignButtons.length) return;
  alignButtons.forEach((button) => {
    const isActive = button.dataset.action === activeAction;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function getAlignmentActionForLine(line) {
  if (line.startsWith('::center:: ')) return 'align-center';
  if (line.startsWith('::right:: ')) return 'align-right';
  if (line.startsWith('::justify:: ')) return 'align-justify';
  return 'align-left';
}

function syncAlignmentButtonsToSelection() {
  if (!editor) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return;
  }
  const text = getPlainText();
  const { start: rawStart } = getSelectionOffsets();
  const start = Math.max(0, Math.min(rawStart, text.length));
  const lineMeta = getLineMeta(text);
  const lineIndex = findLineIndexForPosition(lineMeta, start);
  if (lineIndex === -1) return;
  const action = getAlignmentActionForLine(lineMeta[lineIndex].content);
  updateAlignmentButtons(action);
}

function stripAlignmentMarker(line) {
  for (const marker of ALIGNMENT_MARKERS) {
    if (line.startsWith(marker)) {
      return line.slice(marker.length);
    }
  }
  return line;
}

function applyAlignmentStyle(action) {
  if (!editor || !action) return;
  const prefix = ALIGNMENT_PREFIX_BY_ACTION[action];
  if (prefix === undefined) return;

  const text = getPlainText();
  const { start: rawStart, end: rawEnd } = getSelectionOffsets();
  const boundedStart = Math.max(0, Math.min(rawStart, rawEnd));
  const boundedEnd = Math.max(0, Math.max(rawStart, rawEnd));
  const start = Math.min(boundedStart, text.length);
  const end = Math.min(boundedEnd, text.length);
  const result = applyAlignmentMarkers(text, start, end, prefix);

  if (!result) return;
  setPlainText(result.newText);
  setSelectionRange(result.newStart, result.newEnd);
  markAsModified();
  updateWordCount();
}

function applyAlignmentMarkers(text, selectionStart, selectionEnd, prefix) {
  const lineMeta = getLineMeta(text);
  if (!lineMeta.length) return null;
  const { startIdx, endIdx } = getSelectionLineRange(lineMeta, selectionStart, selectionEnd);
  if (startIdx === -1 || endIdx === -1) return null;

  const edits = [];
  const adjustments = [];

  const queueEdit = (start, end, value) => {
    if (start === end && !value) return;
    edits.push({ start, end, value });
    adjustments.push({ pos: start, delta: value.length - (end - start) });
  };

  const queueLineReplacement = (idx, content) => {
    const line = lineMeta[idx];
    if (!line || line.content === content) return;
    queueEdit(line.start, line.end, content);
  };

  for (let idx = startIdx; idx <= endIdx; idx++) {
    const baseLine = stripAlignmentMarker(lineMeta[idx].content);
    const nextLine = prefix ? `${prefix}${baseLine}` : baseLine;
    queueLineReplacement(idx, nextLine);
  }

  if (!edits.length) {
    return null;
  }

  return finalizeEdits(text, edits, adjustments, selectionStart, selectionEnd);
}

function applyParagraphStyle(text, selectionStart, selectionEnd, style) {
  const lineMeta = getLineMeta(text);
  if (!lineMeta.length) return null;
  const { startIdx, endIdx } = getSelectionLineRange(lineMeta, selectionStart, selectionEnd);
  if (startIdx === -1 || endIdx === -1) return null;

  const edits = [];
  const adjustments = [];

  const queueEdit = (start, end, value) => {
    if (start === end && !value) return;
    edits.push({ start, end, value });
    adjustments.push({ pos: start, delta: value.length - (end - start) });
  };

  const queueLineReplacement = (idx, content) => {
    const line = lineMeta[idx];
    if (!line || line.content === content) return;
    queueEdit(line.start, line.end, content);
  };

  const applyParagraphPrefix = (prefix) => {
    for (let idx = startIdx; idx <= endIdx; idx++) {
      const baseLine = stripParagraphMarkers(lineMeta[idx].content);
      queueLineReplacement(idx, `${prefix}${baseLine}`);
    }
  };

  switch (style) {
    case 'paragraph-none':
      for (let idx = startIdx; idx <= endIdx; idx++) {
        const cleaned = stripParagraphMarkers(lineMeta[idx].content);
        queueLineReplacement(idx, cleaned);
      }
      removeCodeBlockFences(lineMeta, startIdx, endIdx, queueEdit);
      break;

    case 'paragraph-codeblock': {
      const removed = removeCodeBlockFences(lineMeta, startIdx, endIdx, queueEdit);
      if (!removed) {
        const prefix = '```\n';
        const suffix = '\n```\n';
        queueEdit(lineMeta[startIdx].start, lineMeta[startIdx].start, prefix);
        queueEdit(lineMeta[endIdx].endWithNewline, lineMeta[endIdx].endWithNewline, suffix);
      }
      break;
    }

    default: {
      const paragraphPrefixes = {
        'paragraph-title': '# ',
        'paragraph-heading1': '## ',
        'paragraph-heading2': '### ',
        'paragraph-blockquote': '> ',
        'paragraph-caption': '::caption:: ',
        'paragraph-centered': '::center:: ',
        'paragraph-verse': '::verse:: ',
        'paragraph-attribution': '— ',
      };
      if (paragraphPrefixes[style]) {
        applyParagraphPrefix(paragraphPrefixes[style]);
      }
      break;
    }
  }

  if (!edits.length) {
    return null;
  }

  return finalizeEdits(text, edits, adjustments, selectionStart, selectionEnd);
}

function applyCharacterStyle(text, selectionStart, selectionEnd, style) {
  if (selectionStart === selectionEnd) {
    updateStatusText('Выделите текст');
    return null;
  }

  const selected = text.slice(selectionStart, selectionEnd);
  let replacement = selected;

  if (style === 'character-emphasis') {
    if (selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2) {
      replacement = selected.slice(1, -1);
    } else {
      replacement = `*${selected}*`;
    }
  } else if (style === 'character-code-span') {
    if (selected.startsWith('`') && selected.endsWith('`') && selected.length >= 2) {
      replacement = selected.slice(1, -1);
    } else {
      replacement = `\`${selected}\``;
    }
  }

  const edits = [{ start: selectionStart, end: selectionEnd, value: replacement }];
  const adjustments = [{ pos: selectionStart, delta: replacement.length - (selectionEnd - selectionStart) }];
  const newText = applyEditsToText(text, edits);
  const sortedAdjustments = adjustments.slice().sort((a, b) => a.pos - b.pos);
  const newStart = mapPosition(selectionStart, sortedAdjustments, newText.length);
  const newEnd = mapPosition(selectionEnd, sortedAdjustments, newText.length);
  return { newText, newStart, newEnd };
}

function getLineMeta(text) {
  const rawLines = text.split('\n');
  const meta = [];
  let cursor = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const content = rawLines[i];
    const start = cursor;
    const end = start + content.length;
    const hasNewline = i < rawLines.length - 1;
    const endWithNewline = hasNewline ? end + 1 : end;
    meta.push({ content, start, end, endWithNewline });
    cursor = endWithNewline;
  }
  if (!meta.length) {
    meta.push({ content: '', start: 0, end: 0, endWithNewline: 0 });
  }
  return meta;
}

function getSelectionLineRange(meta, selectionStart, selectionEnd) {
  const startIdx = findLineIndexForPosition(meta, selectionStart);
  const effectiveEnd = selectionEnd > selectionStart ? selectionEnd - 1 : selectionStart;
  const endIdx = findLineIndexForPosition(meta, effectiveEnd);
  return { startIdx, endIdx };
}

function findLineIndexForPosition(meta, position) {
  if (!meta.length) return -1;
  for (let i = 0; i < meta.length; i++) {
    if (position <= meta[i].endWithNewline) {
      return i;
    }
  }
  return meta.length - 1;
}

function stripParagraphMarkers(line) {
  let cleaned = line;
  const markers = [
    '::caption:: ',
    '::center:: ',
    '::right:: ',
    '::justify:: ',
    '::verse:: ',
    '— ',
    '> ',
    '### ',
    '## ',
    '# ',
  ];
  let loop = true;
  while (loop) {
    loop = false;
    for (const marker of markers) {
      if (cleaned.startsWith(marker)) {
        cleaned = cleaned.slice(marker.length);
        loop = true;
        break;
      }
    }
  }
  return cleaned;
}

function removeCodeBlockFences(meta, startIdx, endIdx, queueEdit) {
  const beforeIdx = startIdx - 1;
  const afterIdx = endIdx + 1;
  if (
    beforeIdx >= 0 &&
    afterIdx < meta.length &&
    meta[beforeIdx].content.trim() === '```' &&
    meta[afterIdx].content.trim() === '```'
  ) {
    queueEdit(meta[beforeIdx].start, meta[beforeIdx].endWithNewline, '');
    queueEdit(meta[afterIdx].start, meta[afterIdx].endWithNewline, '');
    return true;
  }
  return false;
}

function applyEditsToText(text, edits) {
  if (!edits.length) return text;
  const sorted = edits.slice().sort((a, b) => a.start - b.start);
  let cursor = 0;
  let result = '';
  for (const edit of sorted) {
    if (edit.start > cursor) {
      result += text.slice(cursor, edit.start);
    }
    result += edit.value;
    cursor = edit.end;
  }
  result += text.slice(cursor);
  return result;
}

function finalizeEdits(text, edits, adjustments, selectionStart, selectionEnd) {
  const newText = applyEditsToText(text, edits);
  const sortedAdjustments = adjustments.slice().sort((a, b) => a.pos - b.pos);
  const newStart = mapPosition(selectionStart, sortedAdjustments, newText.length);
  const newEnd = mapPosition(selectionEnd, sortedAdjustments, newText.length);
  return { newText, newStart, newEnd };
}

function mapPosition(index, adjustments, textLength) {
  let mapped = index;
  for (const adjustment of adjustments) {
    if (adjustment.pos <= index) {
      mapped += adjustment.delta;
    }
  }
  return Math.max(0, Math.min(mapped, textLength));
}

function updateThemeSwatches(theme) {
  if (themeDarkButton) {
    themeDarkButton.classList.toggle('is-active', theme === 'dark');
  }
  if (themeLightButton) {
    themeLightButton.classList.toggle('is-active', theme === 'light');
  }
}

  function applyFont(fontFamily) {
    editor.style.fontFamily = fontFamily;
    localStorage.setItem('editorFont', fontFamily);
    commitDesignOsDormantTypographyDesignPatch();
  }

function loadSavedFont() {
  const savedFont = localStorage.getItem('editorFont');
  const hasOption =
    fontSelect &&
    Array.from(fontSelect.options).some((option) => option.value === savedFont);

  if (savedFont && hasOption) {
    applyFont(savedFont);
    if (fontSelect) {
      fontSelect.value = savedFont;
    }
  } else if (fontSelect) {
    const fallbackFont = fontSelect.value;
    if (fallbackFont) {
      applyFont(fallbackFont);
      localStorage.setItem('editorFont', fallbackFont);
    }
  }
}

if (window.electronAPI) {
  window.electronAPI.onFontChanged((fontFamily) => {
    applyFont(fontFamily);
    if (fontSelect) {
      fontSelect.value = fontFamily;
    }
  });
}

loadSavedFont();

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  localStorage.setItem('editorTheme', theme);
  updateThemeSwatches(theme);
  commitDesignOsDormantThemeDesignPatch();
  updateInspectorSnapshot();
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem('editorTheme') || 'light';
  applyTheme(savedTheme);
}

if (window.electronAPI) {
  window.electronAPI.onThemeChanged((theme) => {
    applyTheme(theme);
  });
}

loadSavedTheme();

function setToolbarCompactMode(isCompact) {
  if (!toolbar) return;
  toolbar.classList.toggle(TOOLBAR_COMPACT_CLASS, isCompact);
  if (toolbarToggleButton) {
    toolbarToggleButton.textContent = isCompact ? 'max' : 'min';
    toolbarToggleButton.setAttribute(
      'aria-label',
      isCompact ? 'Maximize toolbar' : 'Minimize toolbar'
    );
  }
}

function toggleToolbarCompactMode() {
  if (!toolbar) return;
  const nextState = !toolbar.classList.contains(TOOLBAR_COMPACT_CLASS);
  setToolbarCompactMode(nextState);
}

setToolbarCompactMode(false);

function handleFind() {
  if (!editor) return { performed: false, found: false, query: '' };
  const query = window.prompt('Find', lastSearchQuery);
  if (!query) return { performed: false, found: false, query: '' };
  const text = getPlainText();
  const normalized = text.toLowerCase();
  const needle = query.toLowerCase();
  const { end: currentEnd } = getSelectionOffsets();
  const startIndex = query === lastSearchQuery ? currentEnd : 0;
  let index = normalized.indexOf(needle, startIndex);

  if (index === -1 && startIndex > 0) {
    index = normalized.indexOf(needle, 0);
  }

  if (index === -1) {
    updateStatusText('Не найдено');
    return { performed: true, found: false, query };
  }

  lastSearchQuery = query;
  editor.focus();
  setSelectionRange(index, index + query.length);
  return { performed: true, found: true, query, index };
}

function handleReplace() {
  if (!editor) return { performed: false, replaced: 0 };
  const query = window.prompt('Find', lastSearchQuery);
  if (!query) return { performed: false, replaced: 0 };
  const replacement = window.prompt('Replace with', '');
  if (replacement === null) return { performed: false, replaced: 0 };

  const text = getPlainText();
  if (!text.includes(query)) {
    updateStatusText('Не найдено');
    return { performed: true, replaced: 0 };
  }

  let replaced = 0;
  let cursor = 0;
  while (cursor <= text.length) {
    const index = text.indexOf(query, cursor);
    if (index === -1) break;
    replaced += 1;
    cursor = index + query.length;
    if (query.length === 0) break;
  }

  if (replaced === 0) {
    updateStatusText('Не найдено');
    return { performed: true, replaced: 0 };
  }

  const next = text.split(query).join(replacement);
  setPlainText(next);
  markAsModified();
  updateWordCount();
  lastSearchQuery = query;
  updateStatusText(`Заменено: ${replaced}`);
  return { performed: true, replaced };
}

function handleUndo() {
  if (!editor) return { performed: false };
  if (isTiptapMode) {
    return undoTiptap();
  }
  editor.focus();
  document.execCommand('undo');
  return { performed: true };
}

function handleRedo() {
  if (!editor) return { performed: false };
  if (isTiptapMode) {
    return redoTiptap();
  }
  editor.focus();
  document.execCommand('redo');
  return { performed: true };
}

function handleZoomOut() {
  changeEditorZoom(-EDITOR_ZOOM_STEP);
  return { performed: true, direction: 'out' };
}

function handleZoomIn() {
  changeEditorZoom(EDITOR_ZOOM_STEP);
  return { performed: true, direction: 'in' };
}

function handleToggleWrap() {
  applyWordWrap(!wordWrapEnabled);
  return { performed: true, enabled: wordWrapEnabled };
}

async function handleInsertMarkdownPrompt() {
  await handleMarkdownImportUiPath();
  return { performed: true };
}

async function handleInsertFlowOpen() {
  await handleFlowModeOpenUiPath();
  return { performed: true };
}

function handleInsertAddCard() {
  const selection = window.getSelection();
  const text = selection && editor && editor.contains(selection.anchorNode) ? selection.toString() : '';
  openCardModal(text);
  return { performed: true, source: 'selection' };
}

function handleFormatAlign(action) {
  if (!Object.prototype.hasOwnProperty.call(ALIGNMENT_PREFIX_BY_ACTION, action)) {
    return { performed: false, reason: 'ALIGN_ACTION_UNKNOWN' };
  }
  applyAlignmentStyle(action);
  updateAlignmentButtons(action);
  return { performed: true, action };
}

async function handlePlanFlowSave() {
  await handleFlowModeSaveUiPath();
  return { performed: true };
}

async function handleReviewExportMarkdown() {
  await handleMarkdownExportUiPath();
  return { performed: true };
}

async function invokePreloadUiCommandBridge(commandId, payload = {}) {
  if (!window.electronAPI || typeof window.electronAPI.invokeUiCommandBridge !== 'function') {
    return { ok: false, reason: 'UI_COMMAND_BRIDGE_UNAVAILABLE' };
  }
  try {
    return await window.electronAPI.invokeUiCommandBridge({
      route: COMMAND_BUS_ROUTE,
      commandId,
      payload,
    });
  } catch (error) {
    return {
      ok: false,
      reason: 'UI_COMMAND_BRIDGE_FAILED',
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

async function handleUiSetThemeCommand(payload = {}) {
  const nextTheme = payload && payload.theme === 'dark'
    ? 'dark'
    : (payload && payload.theme === 'light' ? 'light' : '');
  if (!nextTheme) {
    return { performed: false, reason: 'THEME_INVALID' };
  }
  const bridgeResult = await invokePreloadUiCommandBridge(UI_COMMAND_IDS.THEME_SET, { theme: nextTheme });
  if (!bridgeResult || bridgeResult.ok !== true) {
    return {
      performed: false,
      reason: bridgeResult && typeof bridgeResult.reason === 'string'
        ? bridgeResult.reason
        : 'THEME_BRIDGE_FAILED',
    };
  }
  return { performed: true, theme: nextTheme };
}

async function handleUiSetFontCommand(payload = {}) {
  const fontFamily = typeof payload?.fontFamily === 'string'
    ? payload.fontFamily.trim()
    : '';
  if (!fontFamily) {
    return { performed: false, reason: 'FONT_INVALID' };
  }
  const bridgeResult = await invokePreloadUiCommandBridge(UI_COMMAND_IDS.FONT_SET, { fontFamily });
  if (!bridgeResult || bridgeResult.ok !== true) {
    return {
      performed: false,
      reason: bridgeResult && typeof bridgeResult.reason === 'string'
        ? bridgeResult.reason
        : 'FONT_BRIDGE_FAILED',
    };
  }
  return { performed: true, fontFamily };
}

async function handleUiSetFontSizeCommand(payload = {}) {
  const px = Number(payload?.px);
  if (!Number.isFinite(px) || px < 8 || px > 96) {
    return { performed: false, reason: 'FONT_SIZE_INVALID' };
  }
  const bridgeResult = await invokePreloadUiCommandBridge(UI_COMMAND_IDS.FONT_SIZE_SET, { px });
  if (!bridgeResult || bridgeResult.ok !== true) {
    return {
      performed: false,
      reason: bridgeResult && typeof bridgeResult.reason === 'string'
        ? bridgeResult.reason
        : 'FONT_SIZE_BRIDGE_FAILED',
    };
  }
  return { performed: true, px };
}

function handleUiAction(action) {
  switch (action) {
    case 'save-as':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_SAVE_AS);
      return true;
    case 'search':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_FIND);
      return true;
    case 'replace':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_REPLACE);
      return true;
    case 'new':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_NEW);
      return true;
    case 'clear':
      if (editor) {
        setPlainText('');
        markAsModified();
        updateWordCount();
      }
      return true;
    case 'open':
      void dispatchUiCommand(COMMAND_IDS.PROJECT_OPEN);
      return true;
    case 'save':
      if (flowModeState.active) {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.PLAN_FLOW_SAVE);
      } else {
        void dispatchUiCommand(COMMAND_IDS.PROJECT_SAVE);
      }
      return true;
    case 'export-docx-min':
      openExportPreviewModal();
      return true;
    case 'import-markdown-v1':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_MARKDOWN_PROMPT);
      return true;
    case 'export-markdown-v1':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_EXPORT_MARKDOWN);
      return true;
    case 'theme-dark':
      void dispatchUiCommand(UI_COMMAND_IDS.THEME_SET, { theme: 'dark' });
      return true;
    case 'theme-light':
      void dispatchUiCommand(UI_COMMAND_IDS.THEME_SET, { theme: 'light' });
      return true;
    case 'toggle-wrap':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_WRAP);
      return true;
    case 'zoom-out':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_ZOOM_OUT);
      return true;
    case 'zoom-in':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_ZOOM_IN);
      return true;
    case 'align-left':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT);
      return true;
    case 'align-center':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_CENTER);
      return true;
    case 'align-right':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_RIGHT);
      return true;
    case 'align-justify':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_JUSTIFY);
      return true;
    case 'minimize':
      toggleToolbarCompactMode();
      return true;
    case 'open-settings':
      openSettingsModal();
      return true;
    case 'open-diagnostics':
      openDiagnosticsModal();
      return true;
    case 'open-recovery':
      openRecoveryModal('Recovery modal opened manually');
      return true;
    default:
      return false;
  }
}

function handleCanonicalRuntimeCommandId(commandId) {
  if (commandId === EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.VIEW_SAFE_RESET) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_SAFE_RESET);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.VIEW_RESTORE_LAST_STABLE) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_RESTORE_LAST_STABLE);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.INSERT_ADD_CARD) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_ADD_CARD);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.PLAN_SWITCH_MODE) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.PLAN_SWITCH_MODE);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.REVIEW_SWITCH_MODE) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_SWITCH_MODE);
    return true;
  }
  if (commandId === EXTRA_COMMAND_IDS.WINDOW_SWITCH_MODE_WRITE) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.WINDOW_SWITCH_MODE_WRITE);
    return true;
  }
  return false;
}

if (toolbar) {
  toolbar.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (handleUiAction(action)) {
      event.preventDefault();
    }
  });
}

if (styleSelect) {
  styleSelect.addEventListener('change', (event) => {
    applyViewMode(event.target.value);
  });
}

if (textStyleSelect) {
  textStyleSelect.addEventListener('change', (event) => {
    applyTextStyle(event.target.value);
    textStyleSelect.value = TEXT_STYLE_DEFAULT;
  });
}

if (fontSelect) {
  fontSelect.addEventListener('change', (event) => {
    const fontFamily = typeof event?.target?.value === 'string' ? event.target.value : '';
    if (!fontFamily.trim()) return;
    void dispatchUiCommand(UI_COMMAND_IDS.FONT_SET, { fontFamily });
  });
}

if (weightSelect) {
  weightSelect.addEventListener('change', (event) => {
    applyFontWeight(event.target.value);
  });
}

if (sizeSelect) {
  sizeSelect.addEventListener('change', (event) => {
    const nextSize = Number(event.target.value);
    if (Number.isFinite(nextSize)) {
      void dispatchUiCommand(UI_COMMAND_IDS.FONT_SIZE_SET, { px: nextSize });
      return;
    }
    const customSize = promptForCustomFontSize();
    if (Number.isFinite(customSize)) {
      void dispatchUiCommand(UI_COMMAND_IDS.FONT_SIZE_SET, { px: customSize });
    }
  });
}

if (lineHeightSelect) {
  lineHeightSelect.addEventListener('change', (event) => {
    applyLineHeight(event.target.value);
  });
}

function loadSavedViewMode() {
  const saved = localStorage.getItem('editorViewMode') || 'default';
  applyViewMode(saved, false);
}

function loadSavedFontWeight() {
  const saved = localStorage.getItem('editorFontWeight');
  const presetId = resolveFontWeightPresetId(saved || 'regular');
  applyFontWeight(presetId, false);
  if (weightSelect) {
    weightSelect.value = getWeightSelectValueForPresetId(presetId);
  }
}

function loadSavedLineHeight() {
  const saved = localStorage.getItem('editorLineHeight');
  if (saved) {
    applyLineHeight(saved, false);
  } else {
    applyLineHeight('1.625', false);
  }
}

function loadSavedWordWrap() {
  const saved = localStorage.getItem('editorWordWrap');
  const enabled = saved !== 'off';
  applyWordWrap(enabled, false);
}

loadSavedViewMode();
loadSavedFontWeight();
loadSavedLineHeight();
loadSavedWordWrap();
loadSavedEditorZoom();
restoreSpatialLayoutState(currentProjectId);

setPlainText('');
metaPanel?.classList.add('is-hidden');
if (rightSceneMetaPanel && metaPanel) {
  rightSceneMetaPanel.appendChild(metaPanel);
}
updateSaveStateText('idle');
updateWarningStateText(buildDormantWarningHintText('none'));
updatePerfHintText('normal');
updateInspectorSnapshot();
applyMode('write');
applyLeftTab('project');
applyRightTab('inspector');
installNetworkGuard();
void initializeCollabScopeLocal();

loadTree();

if (modeSwitcher) {
  modeSwitcher.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    const mode = button.dataset.mode;
    if (mode === 'write' || mode === 'plan' || mode === 'review') {
      applyMode(mode);
    }
  });
}

if (leftTabsHost) {
  leftTabsHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-left-tab]');
    if (!button) return;
    const tab = button.dataset.leftTab;
    if (tab === 'project' || tab === 'outline' || tab === 'search') {
      applyLeftTab(tab);
    }
  });
}

if (rightTabsHost) {
  rightTabsHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-right-tab]');
    if (!button) return;
    const tab = button.dataset.rightTab;
    if (tab === 'inspector' || tab === 'scene-meta' || tab === 'comments' || tab === 'history') {
      applyRightTab(tab);
    }
  });
}

if (leftSearchInput) {
  leftSearchInput.addEventListener('input', () => {
    if (currentLeftTab === 'search') {
      renderSearchResults(leftSearchInput.value);
    }
  });
}

if (settingsThemeSelect) {
  settingsThemeSelect.addEventListener('change', () => {
    const nextTheme = settingsThemeSelect.value === 'dark' ? 'dark' : 'light';
    void dispatchUiCommand(UI_COMMAND_IDS.THEME_SET, { theme: nextTheme });
  });
}

if (settingsWrapSelect) {
  settingsWrapSelect.addEventListener('change', () => {
    const enabled = settingsWrapSelect.value !== 'off';
    applyWordWrap(enabled);
    updateInspectorSnapshot();
  });
}

settingsCloseButtons.forEach((button) => {
  button.addEventListener('click', () => closeSimpleModal(settingsModal));
});
recoveryCloseButtons.forEach((button) => {
  button.addEventListener('click', () => closeSimpleModal(recoveryModal));
});
exportPreviewCancelButtons.forEach((button) => {
  button.addEventListener('click', () => closeSimpleModal(exportPreviewModal));
});
exportPreviewConfirmButtons.forEach((button) => {
  button.addEventListener('click', () => {
    void confirmExportPreviewAndRun();
  });
});
diagnosticsCloseButtons.forEach((button) => {
  button.addEventListener('click', () => closeSimpleModal(diagnosticsModal));
});

document.addEventListener('keydown', (event) => {
  const isPrimaryModifier = isMac ? event.metaKey : event.ctrlKey;
  if (!isPrimaryModifier || event.altKey) {
    return;
  }

  const { key, code } = event;
  const isPlus =
    ['+', '=', 'Add'].includes(key) || code === 'Equal' || code === 'NumpadAdd';
  const isMinus =
    ['-'].includes(key) || code === 'Minus' || code === 'NumpadSubtract';
  const isZero =
    key === '0' || code === 'Digit0' || code === 'Numpad0';

  if (!isPlus && !isMinus && !isZero) {
    if ((key === 'N' || key === 'n') && !event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_NEW);
      return;
    }
    if ((key === 'O' || key === 'o') && !event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(COMMAND_IDS.PROJECT_OPEN);
      return;
    }
    if ((key === 'S' || key === 's') && !event.shiftKey) {
      event.preventDefault();
      if (flowModeState.active) {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.PLAN_FLOW_SAVE);
      } else {
        void dispatchUiCommand(COMMAND_IDS.PROJECT_SAVE);
      }
      return;
    }
    if ((key === 'S' || key === 's') && event.shiftKey && !flowModeState.active) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_SAVE_AS);
      return;
    }
    if ((key === 'Z' || key === 'z') && !event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_UNDO);
      return;
    }
    if ((key === 'Z' || key === 'z') && event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_REDO);
      return;
    }
    if ((key === 'Y' || key === 'y') && !event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_REDO);
      return;
    }
    if ((key === 'F' || key === 'f') && !event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_FIND);
      return;
    }
    if ((key === 'H' || key === 'h') && !event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_REPLACE);
      return;
    }
    if ((key === 'E' || key === 'e') && event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);
      return;
    }
    if ((key === 'I' || key === 'i') && event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_MARKDOWN_PROMPT);
      return;
    }
    if ((key === 'M' || key === 'm') && event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_EXPORT_MARKDOWN);
      return;
    }
    if ((key === 'F' || key === 'f') && event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_FLOW_OPEN);
      return;
    }
    if ((key === 'K' || key === 'k') && event.shiftKey) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_ADD_CARD);
      return;
    }
    if ((key === 'S' || key === 's') && event.shiftKey && flowModeState.active) {
      event.preventDefault();
      void dispatchUiCommand(EXTRA_COMMAND_IDS.PLAN_FLOW_SAVE);
      return;
    }
    return;
  }

  event.preventDefault();
  if (isPlus) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_ZOOM_IN);
    return;
  }
  if (isMinus) {
    void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_ZOOM_OUT);
    return;
  }
  if (isZero) {
    setEditorZoom(EDITOR_ZOOM_DEFAULT);
  }
}, true);
document.addEventListener('selectionchange', syncAlignmentButtonsToSelection);

window.addEventListener('resize', () => {
  updateSpatialLayoutForViewportChange();
  syncDesignOsDormantContext();
  scheduleLayoutRefresh();
});

mountDesignOsDormantRuntime();
syncDesignOsDormantContext();

if (window.electronAPI) {
  window.electronAPI.onEditorSetText((payload) => {
    const content = typeof payload === 'string' ? payload : payload?.content || '';
    const title = typeof payload === 'object' && payload ? payload.title : '';
    const hasPath = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'path');
    const hasKind = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'kind');
    const hasProjectId = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'projectId');
    const path = hasPath ? payload.path : '';
    const kind = hasKind ? payload.kind : '';
    const projectId = hasProjectId && typeof payload.projectId === 'string' ? payload.projectId : '';
    const nextMetaEnabled = typeof payload === 'object' && payload ? Boolean(payload.metaEnabled) : false;

    clearFlowModeState();
    metaEnabled = nextMetaEnabled;
    if (hasPath) {
      currentDocumentPath = path || null;
    }
    if (hasKind) {
      currentDocumentKind = kind || null;
    }
    if (hasProjectId) {
      const nextProjectId = normalizeProjectId(projectId);
      if (nextProjectId !== currentProjectId) {
        currentProjectId = nextProjectId;
        expandedNodesByTab = new Map();
        restoreSpatialLayoutState(currentProjectId);
      }
    }

    const parsed = parseDocumentContent(content);
    currentMeta = parsed.meta;
    currentCards = parsed.cards;
    setPlainText(parsed.text || '');
    updateMetaInputs();
    updateMetaVisibility();
    updateCardsList();

    localDirty = false;
    updateWordCount();

    const resolvedTitle = title || getTitleFromPath(path);
    if (resolvedTitle) {
      showEditorPanelFor(resolvedTitle);
    }
    remountDesignOsDormantRuntimeForCurrentDocumentContext();
    renderTree();
    updateSaveStateText('loaded');
    updatePerfHintText('normal');
    updateInspectorSnapshot();
    syncDesignOsDormantTextInput();
  });

  window.electronAPI.onEditorTextRequest(({ requestId }) => {
    window.electronAPI.sendEditorTextResponse(requestId, composeDocumentContent());
  });

  window.electronAPI.onEditorSetFontSize(({ px }) => {
    if (Number.isFinite(px)) {
      editor.style.fontSize = `${px}px`;
      setCurrentFontSize(px);
      renderStyledView(getPlainText());
      commitDesignOsDormantTypographyDesignPatch();
    }
  });

  if (typeof window.electronAPI.onRecoveryRestored === 'function') {
    window.electronAPI.onRecoveryRestored((payload) => {
      const message = payload && typeof payload.message === 'string'
        ? payload.message
        : 'Recovered from autosave';
      updateWarningStateText(buildDormantWarningHintText('recovery restored'));
      openRecoveryModal(message);
      updateInspectorSnapshot();
    });
  }

  if (isTiptapMode) {
    setTiptapRuntimeHandlers({
      openSettings: () => openSettingsModal(),
      safeResetShell: () => performSafeResetShell(),
      restoreLastStableShell: () => performRestoreLastStableShell(),
      openDiagnostics: () => openDiagnosticsModal(),
      openRecovery: () => openRecoveryModal('Recovery modal opened from menu'),
      openExportPreview: () => openExportPreviewModal(),
      insertAddCard: () => handleInsertAddCard(),
      formatAlignLeft: () => {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT);
      },
      switchMode: (mode) => applyMode(mode),
    });
  } else if (typeof window.electronAPI.onRuntimeCommand === 'function') {
    window.electronAPI.onRuntimeCommand((payload) => {
      const commandId = payload && typeof payload.commandId === 'string' ? payload.commandId : '';
      if (handleCanonicalRuntimeCommandId(commandId)) {
        return;
      }
      const command = payload && typeof payload.command === 'string' ? payload.command : '';
      if (command === 'open-settings') {
        openSettingsModal();
      } else if (command === 'safe-reset-shell') {
        performSafeResetShell();
      } else if (command === 'restore-last-stable-shell') {
        performRestoreLastStableShell();
      } else if (command === 'open-diagnostics') {
        openDiagnosticsModal();
      } else if (command === 'open-recovery') {
        openRecoveryModal('Recovery modal opened from menu');
      } else if (command === 'open-export-preview') {
        openExportPreviewModal();
      } else if (command === 'insert-add-card') {
        handleInsertAddCard();
      } else if (command === 'format-align-left') {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT);
      } else if (command === 'switch-mode-plan') {
        applyMode('plan');
      } else if (command === 'switch-mode-review') {
        applyMode('review');
      } else if (command === 'switch-mode-write') {
        applyMode('write');
      }
    });
  }
}

if (isTiptapMode) {
  editor.addEventListener('input', () => {
    syncPlainTextBufferFromEditorDom();
    syncDesignOsDormantTextInput();
    markAsModified();
    updateWordCount();
  });
} else {
  editor.addEventListener('pointerdown', (event) => {
    const nextIndex = getPageIndexFromNode(event.target);
    lastPointerDownPageIndex = nextIndex != null ? nextIndex : -1;
  });

  editor.addEventListener('beforeinput', (event) => {
    if (event.isComposing || event.inputType === 'insertCompositionText' || event.inputType === 'deleteCompositionText') {
      return;
    }
    ensureCaretInLastPointerPage();
  });

  editor.addEventListener('compositionstart', () => {
    legacyCompositionActive = true;
    legacyCompositionRenderPending = false;
    cancelDeferredRenderWork();
  });

  editor.addEventListener('compositionend', () => {
    legacyCompositionActive = false;
    window.requestAnimationFrame(() => {
      if (legacyCompositionRenderPending) {
        flushLegacyCompositionRender();
      }
    });
  });

  editor.addEventListener('input', () => {
    scheduleIncrementalInputDomSync();
    syncPlainTextBufferFromEditorDom();
    syncDesignOsDormantTextInput();
    if (legacyCompositionActive) {
      legacyCompositionRenderPending = true;
      return;
    }
    scheduleDeferredHotpathRender({ includePagination: false, preserveSelection: true });
    scheduleDeferredPaginationRefresh();
    markAsModified();
    updateWordCount();
  });

  editor.addEventListener('paste', (event) => {
    ensureCaretInLastPointerPage();
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text) {
      document.execCommand('insertText', false, text);
    }
  });

  editor.addEventListener('keydown', (event) => {
    if (event.isComposing || legacyCompositionActive) {
      return;
    }

    if (flowModeState.active) {
      const { start, end } = getSelectionOffsets();
      const hasCollapsedSelection = start === end;
      if (hasCollapsedSelection && event.key === 'ArrowDown') {
        const nextCaret = nextSceneCaretAtBoundary(getPlainText(), start);
        if (Number.isInteger(nextCaret)) {
          event.preventDefault();
          setSelectionRange(nextCaret, nextCaret);
          return;
        }
      }
      if (hasCollapsedSelection && event.key === 'ArrowUp') {
        const prevCaret = previousSceneCaretAtBoundary(getPlainText(), start);
        if (Number.isInteger(prevCaret)) {
          event.preventDefault();
          setSelectionRange(prevCaret, prevCaret);
          return;
        }
      }
      if (hasCollapsedSelection && event.key === 'Backspace') {
        const prevCaret = previousSceneCaretAtBoundary(getPlainText(), start);
        if (Number.isInteger(prevCaret)) {
          event.preventDefault();
          setSelectionRange(prevCaret, prevCaret);
          return;
        }
      }
    }

    if (event.key === 'Enter') {
      ensureCaretInLastPointerPage();
      event.preventDefault();
      const { start, end } = getSelectionOffsets();
      const text = getPlainText();
      const normalizedStart = Math.max(0, Math.min(start, text.length));
      const normalizedEnd = Math.max(0, Math.min(end, text.length));
      const nextText = `${text.slice(0, normalizedStart)}\n${text.slice(normalizedEnd)}`;
      setPlainText(nextText);
      setSelectionRange(normalizedStart + 1, normalizedStart + 1);
      markAsModified();
      updateWordCount();
    }
  });
}

if (window.electronAPI) {
  window.electronAPI.onStatusUpdate((status) => {
    updateStatusText(status);
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('восстановлено') || normalized.includes('recovery')) {
      updateWarningStateText(buildDormantWarningHintText('recovery'));
    } else if (normalized.includes('ошибка') || normalized.includes('error')) {
      updateWarningStateText(buildDormantWarningHintText('error'));
    } else {
      updateWarningStateText(buildDormantWarningHintText('none'));
    }
    updatePerfHintText('normal');
    updateInspectorSnapshot();
  });

  window.electronAPI.onSetDirty((state) => {
    const previousDirtyState = localDirty === true;
    const nextDirtyState = state === true;
    localDirty = nextDirtyState;
    updateSaveStateText(localDirty ? 'unsaved' : 'saved');
    syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState);
    updateInspectorSnapshot();
  });
}

setCurrentFontSize(currentFontSizePx);
updateWordCount();
