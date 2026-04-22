import {
  applyTiptapCharacterStyle,
  applyTiptapParagraphStyle,
  focusTiptapSurface,
  getTiptapDocumentSnapshot,
  getTiptapFormattingState,
  getTiptapSelectionOffsets,
  getTiptapPlainText,
  initTiptap,
  redoTiptap,
  runTiptapFormatCommand,
  setTiptapDocumentSnapshot,
  setTiptapFormattingStateHandler,
  setTiptapSelectionOffsets,
  setTiptapPlainText,
  setTiptapRuntimeHandlers,
  undoTiptap,
} from './tiptap/index.js';
import { createCommandRegistry } from './commands/registry.mjs';
import { createCommandRunner } from './commands/runCommand.mjs';
import {
  COMMAND_IDS,
  EXTRA_COMMAND_IDS,
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
import {
  composeObservablePayload,
  parseObservablePayload,
} from './documentContentEnvelope.mjs';
import {
  createDefaultBookProfile,
  normalizeBookProfile,
} from '../core/bookProfile.mjs';
import {
  PX_PER_MM_AT_ZOOM_1,
  resolvePageLayoutMetrics,
} from '../core/pageLayoutMetrics.mjs';
import {
  buildLeftRailPresentationTree,
  getLeftRailPresentationExpandKey,
  getLeftRailPresentationKind,
  isLeftRailPresentationDefaultExpanded,
} from './leftRailPresentationModel.mjs';
import {
  applyPreviewChromeCssVars,
  createPreviewChromeState,
} from './previewChrome.mjs';
import {
  buildLayoutPreviewSnapshot,
  createLayoutPreviewState,
  renderLayoutPreviewSnapshot,
} from './layoutPreview.mjs';
import {
  buildLayoutPatchFromSpatialState,
  buildSpatialStateFromLayoutSnapshot,
} from './design-os/index.mjs';
import {
  getToolbarFunctionCatalogEntryById,
  listLiveToolbarFunctionCatalogEntries,
} from './toolbar/toolbarFunctionCatalog.mjs';
import {
  consumeLegacyConfiguratorBuckets,
  createCanonicalMinimalToolbarProfileState,
  createEphemeralBaselineToolbarProfileState,
  createToolbarProfileState,
  getToolbarProfileStorageKey,
  isImplicitExpandedToolbarProfileState,
  resolveToolbarProfileStateForProjectSwitch,
  writeToolbarProfileState,
} from './toolbar/toolbarProfileState.mjs';
import * as toolbarRuntimeProjectionModule from './toolbar/toolbarRuntimeProjection.mjs';
import uiErrorMapDoc from '../../docs/OPS/STATUS/UI_ERROR_MAP.json';

const isTiptapMode = window.__USE_TIPTAP === true;
const editor = document.getElementById('editor');
if (isTiptapMode) {
  initTiptap(editor, {
    attachIpc: false,
    onContentParseIssue: handleDocumentContentParseIssue,
  });
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
const toolbarShell = document.querySelector('[data-toolbar-shell]');
const leftToolbar = document.querySelector('[data-left-toolbar]');
const leftToolbarShell = document.querySelector('[data-left-toolbar-shell]');
const topWorkBar = document.querySelector('[data-top-work-bar]');
const configuratorPanel = document.querySelector('[data-configurator-panel]');
const configuratorMasterSection = document.querySelector('.configurator-panel__section--master');
const configuratorMinimalSection = document.querySelector('.configurator-panel__section--minimal');
const configuratorProfileSwitchButtons = Array.from(document.querySelectorAll('[data-toolbar-profile-switch]'));
const configuratorLibraryGrid = document.querySelector('.configurator-panel__grid');
const gridTriggerButton = document.querySelector('[data-grid-button]');
const configuratorBuckets = Array.from(document.querySelectorAll('[data-configurator-bucket]'));
const toolbarRotateHandles = Array.from(document.querySelectorAll('[data-toolbar-rotate-handle]'));
const toolbarWidthHandle = document.querySelector('[data-toolbar-width-handle]');
const toolbarScaleHandle = document.querySelector('[data-toolbar-scale-handle]');
const leftToolbarRotateHandles = Array.from(document.querySelectorAll('[data-left-toolbar-rotate-handle]'));
const leftToolbarWidthHandle = document.querySelector('[data-left-toolbar-width-handle]');
const leftToolbarScaleHandle = document.querySelector('[data-left-toolbar-scale-handle]');
const leftToolbarCluster = document.querySelector('.left-floating-toolbar .work-bar__cluster');
const leftToolbarButtons = Array.from(document.querySelectorAll('.left-floating-toolbar .work-bar__button[data-action]'));
const leftToolbarSpacingMenu = document.querySelector('[data-left-toolbar-spacing-menu]');
const leftToolbarSpacingAction = document.querySelector('[data-left-toolbar-spacing-action]');
const toolbarTunableItems = Array.from(
  document.querySelectorAll(
    '.floating-toolbar [data-toolbar-item-key], .floating-toolbar .floating-toolbar__button[data-action]'
  )
);
const toolbarSpacingMenu = document.querySelector('[data-toolbar-spacing-menu]');
const toolbarSpacingAction = document.querySelector('[data-toolbar-spacing-action]');
const formatBoldButton = document.querySelector('[data-toolbar-item-key="format-bold"]');
const formatItalicButton = document.querySelector('[data-toolbar-item-key="format-italic"]');
const formatUnderlineButton = document.querySelector('[data-toolbar-item-key="format-underline"]');
const colorTextButton = document.querySelector('[data-toolbar-item-key="color-text"]');
const colorHighlightButton = document.querySelector('[data-toolbar-item-key="color-highlight"]');
const reviewCommentsButton = document.querySelector('[data-toolbar-item-key="review-comment"]');
const styleParagraphButton = document.querySelector('[data-toolbar-item-key="style-paragraph"]');
const styleCharacterButton = document.querySelector('[data-toolbar-item-key="style-character"]');
const paragraphTriggerButton = document.querySelector('[data-toolbar-item-key="paragraph-trigger"]');
const paragraphMenu = document.querySelector('[data-paragraph-menu]');
const listTriggerButton = document.querySelector('[data-toolbar-item-key="list-type"]');
const listMenu = document.querySelector('[data-list-menu]');
const insertLinkButton = document.querySelector('[data-toolbar-item-key="insert-link"]');
const toolbarColorPickerOverlay = document.querySelector('[data-toolbar-color-picker]');
const toolbarColorPickerTitle = document.querySelector('[data-toolbar-color-picker-title]');
const toolbarColorPickerSwatchHost = document.querySelector('[data-toolbar-color-picker-swatches]');
const toolbarColorPickerCloseButton = document.querySelector('[data-toolbar-color-picker-close]');
const toolbarStylesMenu = document.querySelector('[data-toolbar-styles-menu]');
const paragraphStyleOptionButtons = Array.from(document.querySelectorAll('[data-style-paragraph-option]'));
const characterStyleOptionButtons = Array.from(document.querySelectorAll('[data-style-character-option]'));
const listActionButtons = Array.from(document.querySelectorAll('[data-list-action]'));
let toolbarRuntimeRegistry = typeof toolbarRuntimeProjectionModule.createToolbarRuntimeRegistry === 'function'
  ? toolbarRuntimeProjectionModule.createToolbarRuntimeRegistry({
      toolbar,
    })
  : null;
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
const rightCommentsPanel = document.querySelector('[data-right-panel-comments]');
const rightHistoryPanel = document.querySelector('[data-right-panel-history]');
const previewChromeFormatValueElement = Array.from(document.querySelectorAll('.right-rail-form-row')).find((row) => {
  const key = row.querySelector('.right-rail-form-key');
  return key && key.textContent && key.textContent.trim() === 'Формат';
})?.querySelector('.right-rail-form-value');
const inspectorSnapshotElement = document.querySelector('[data-inspector-snapshot]');
const wordCountElement = document.querySelector('[data-word-count]');
const zoomValueElement = document.querySelector('[data-zoom-value]');
const styleSelect = document.querySelector('[data-style-select]');
const fontSelect = document.querySelector('[data-font-select]');
const weightSelect = document.querySelector('[data-weight-select]');
const sizeSelect = document.querySelector('[data-size-select]');
const lineHeightSelect = document.querySelector('[data-line-height-select]');
const fontDisplay = document.querySelector('[data-font-display]');
const weightDisplay = document.querySelector('[data-weight-display]');
const sizeDisplay = document.querySelector('[data-size-display]');
const lineHeightDisplay = document.querySelector('[data-line-height-display]');
const textStyleSelect = document.querySelector('[data-text-style-select]');
const themeDarkButton = document.querySelector('[data-action="theme-dark"]');
const themeLightButton = document.querySelector('[data-action="theme-light"]');
const wrapToggleButton = document.querySelector('[data-action="toggle-wrap"]');
const toolbarToggleButton = document.querySelector('[data-action="minimize"]');
const alignButtons = Array.from(document.querySelectorAll('[data-paragraph-alignment]'));
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
const commandPaletteModal = document.querySelector('[data-command-palette-modal]');
const commandPaletteSearchInput = document.querySelector('[data-command-palette-search]');
const commandPaletteSummary = document.querySelector('[data-command-palette-summary]');
const commandPaletteList = document.querySelector('[data-command-palette-list]');
const commandPaletteCloseButtons = Array.from(document.querySelectorAll('[data-command-palette-close]'));
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
const SPATIAL_LAYOUT_STORAGE_KEY_PREFIX = 'yalkenSpatialLayout';
const SPATIAL_LAYOUT_VERSION = 1;
const SPATIAL_LAYOUT_MOBILE_BREAKPOINT = 900;
const SPATIAL_LAYOUT_COMPACT_BREAKPOINT = 1280;
const SPATIAL_LAYOUT_LEFT_MIN_WIDTH = 200;
const SPATIAL_LAYOUT_LEFT_MAX_WIDTH = 420;
const SPATIAL_LAYOUT_RIGHT_MIN_WIDTH = 200;
const SPATIAL_LAYOUT_RIGHT_MAX_WIDTH = 420;
const SPATIAL_LAYOUT_DESKTOP_LEFT_BASELINE_WIDTH = 290;
const SPATIAL_LAYOUT_DESKTOP_RIGHT_BASELINE_WIDTH = 290;
const SPATIAL_LAYOUT_COMPACT_LEFT_BASELINE_WIDTH = 260;
const SPATIAL_LAYOUT_COMPACT_RIGHT_BASELINE_WIDTH = 260;
const SPATIAL_LAYOUT_MOBILE_LEFT_BASELINE_WIDTH = 240;
const SPATIAL_LAYOUT_MOBILE_RIGHT_BASELINE_WIDTH = 240;
const SAFE_RESET_BASELINE_THEME = 'light';
const SAFE_RESET_BASELINE_FONT_FAMILY = '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const SAFE_RESET_BASELINE_FONT_SIZE_PX = 12;
const SAFE_RESET_BASELINE_FONT_WEIGHT = 'light';
const SAFE_RESET_BASELINE_LINE_HEIGHT = '1.0';
const SAFE_RESET_BASELINE_VIEW_MODE = 'default';
const PROJECT_WORKSPACE_RESET_TABS = Object.freeze(['project', 'outline', 'search', 'roman']);
const TOOLBAR_CONFIGURATOR_LIBRARY_COLUMN_COUNT = 4;
const TOOLBAR_CONFIGURATOR_LIBRARY_MIN_SLOT_COUNT = 20;
const TOOLBAR_CONFIGURATOR_LIBRARY_PLACEHOLDER_TEXT = 'New Slot';
const TOOLBAR_COLOR_PICKER_MODE_LABELS = Object.freeze({
  text: 'Text color',
  highlight: 'Highlight color',
});
const TOOLBAR_COLOR_PICKER_MODE_SWATCHES = Object.freeze({
  text: Object.freeze([
    Object.freeze({ value: '#1f1a15', label: 'Ink' }),
    Object.freeze({ value: '#8a3b2e', label: 'Brick' }),
    Object.freeze({ value: '#2f5f8a', label: 'Blue' }),
    Object.freeze({ value: '#2f6a4f', label: 'Green' }),
  ]),
  highlight: Object.freeze([
    Object.freeze({ value: '#ffdf20', label: 'Yellow' }),
    Object.freeze({ value: '#ffd6e7', label: 'Pink' }),
    Object.freeze({ value: '#cfe8ff', label: 'Sky' }),
    Object.freeze({ value: '#d8f0c2', label: 'Mint' }),
  ]),
});
const TOOLBAR_STYLES_MENU_ANCHORS = Object.freeze({
  paragraph: 'paragraph',
  character: 'character',
});
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
let currentFontSizePx = 12;
let wordWrapEnabled = true;
let collabScopeLocal = false;
let currentMode = 'write';
let currentLeftTab = 'project';
let currentRightTab = 'inspector';
let toolbarColorPickerState = {
  open: false,
  mode: 'text',
  selectedByMode: {
    text: '',
    highlight: '',
  },
};
let toolbarStylesMenuState = {
  open: false,
  anchor: TOOLBAR_STYLES_MENU_ANCHORS.paragraph,
  selectedByKind: {
    paragraph: '',
    character: '',
  },
};
let lastSearchQuery = '';
let plainTextBuffer = '';
const activeTab = 'roman';
let currentDocumentPath = null;
let currentDocumentKind = null;
let currentProjectId = '';
let spatialLayoutState = null;
let flowModeState = {
  active: false,
  scenes: [],
  dirty: false,
};
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
let floatingToolbarState = {
  x: 0,
  y: 0,
  isVertical: false,
  isDetached: false,
  scale: 1,
  widthScale: 1,
  dockedWidthScale: 1,
  freeWidthScale: 1,
  toolbarHeight: 0,
};
let leftFloatingToolbarState = {
  x: 0,
  y: 0,
  isVertical: false,
  isDetached: false,
  scale: 1,
  widthScale: 1,
};
let floatingToolbarInteractionState = {
  mode: null,
  active: false,
  startX: 0,
  startY: 0,
  origin: null,
};
let leftFloatingToolbarInteractionState = {
  mode: null,
  active: false,
  startX: 0,
  startY: 0,
  origin: null,
};
let floatingToolbarHandlesVisible = false;
let floatingToolbarSuppressClickOnce = false;
let toolbarItemSuppressClickOnce = false;
let toolbarSpacingTuningMode = false;
let toolbarAnchorFrameId = 0;
let toolbarItemOffsets = {};
let toolbarItemOffsetDragState = {
  active: false,
  item: null,
  key: '',
  startX: 0,
  originOffset: 0,
  moved: false,
};
let leftFloatingToolbarHandlesVisible = false;
let leftFloatingToolbarSuppressClickOnce = false;
let leftToolbarButtonSuppressClickOnce = false;
let leftToolbarSpacingTuningMode = false;
let leftToolbarAnchorFrameId = 0;
let leftToolbarButtonOffsets = {};
let leftToolbarButtonOffsetDragState = {
  active: false,
  button: null,
  action: '',
  startX: 0,
  originOffset: 0,
  moved: false,
};
const TOOLBAR_CONFIGURATOR_DEFAULT_ACTIVE_PROFILE = 'minimal';
const TOOLBAR_CONFIGURATOR_PROFILE_NAMES = Object.freeze(['minimal', 'master']);
const TOOLBAR_CONFIGURATOR_CANONICAL_LIVE_IDS = Object.freeze(
  listLiveToolbarFunctionCatalogEntries().map((entry) => entry.id)
);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeToolbarConfiguratorProfileName(profileName) {
  return profileName === 'master' ? 'master' : 'minimal';
}

function normalizeToolbarConfiguratorItemIds(rawIds) {
  const normalized = createToolbarProfileState(Array.isArray(rawIds) ? rawIds : []);
  return Array.isArray(normalized?.toolbarProfiles?.minimal)
    ? [...normalized.toolbarProfiles.minimal]
    : [];
}

function createToolbarConfiguratorCanonicalProfileIds() {
  return [...TOOLBAR_CONFIGURATOR_CANONICAL_LIVE_IDS];
}

function createToolbarConfiguratorSeedState() {
  const canonicalMinimalState = createCanonicalMinimalToolbarProfileState();
  const canonicalMinimalIds = Array.isArray(canonicalMinimalState?.toolbarProfiles?.minimal)
    ? canonicalMinimalState.toolbarProfiles.minimal
    : createToolbarConfiguratorCanonicalProfileIds();
  return Object.freeze({
    version: 3,
    activeToolbarProfile: TOOLBAR_CONFIGURATOR_DEFAULT_ACTIVE_PROFILE,
    toolbarProfiles: Object.freeze({
      minimal: Object.freeze([...canonicalMinimalIds]),
      master: Object.freeze(createToolbarConfiguratorCanonicalProfileIds()),
    }),
  });
}

function createToolbarConfiguratorState(rawState = {}) {
  const source = isPlainObject(rawState) ? rawState : {};
  const rawToolbarProfiles = isPlainObject(source.toolbarProfiles) ? source.toolbarProfiles : {};
  const hasMinimal = Object.prototype.hasOwnProperty.call(rawToolbarProfiles, 'minimal');
  const hasMaster = Object.prototype.hasOwnProperty.call(rawToolbarProfiles, 'master');

  return Object.freeze({
    version: 3,
    activeToolbarProfile: normalizeToolbarConfiguratorProfileName(source.activeToolbarProfile),
    toolbarProfiles: Object.freeze({
      minimal: Object.freeze(normalizeToolbarConfiguratorItemIds(hasMinimal ? rawToolbarProfiles.minimal : [])),
      master: Object.freeze(
        hasMaster
          ? normalizeToolbarConfiguratorItemIds(rawToolbarProfiles.master)
          : createToolbarConfiguratorCanonicalProfileIds()
      ),
    }),
  });
}

function readToolbarConfiguratorStoredState(projectId = currentProjectId) {
  const storageKey = getToolbarProfileStorageKey(projectId);
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeToolbarConfiguratorStoredState(projectId, state) {
  const storageKey = getToolbarProfileStorageKey(projectId);
  if (!storageKey) return false;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function resolveToolbarConfiguratorState(projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    return {
      source: 'ephemeral',
      shouldPersist: false,
      shouldConsumeLegacySource: false,
      state: createToolbarConfiguratorSeedState(),
    };
  }

  const rawState = readToolbarConfiguratorStoredState(normalizedProjectId);
  if (isPlainObject(rawState)) {
    const normalizedState = createToolbarConfiguratorState(rawState);
    const effectiveState = isImplicitExpandedToolbarProfileState(normalizedState)
      ? createToolbarConfiguratorSeedState()
      : normalizedState;
    return {
      source: 'persisted',
      shouldPersist: JSON.stringify(rawState) !== JSON.stringify(effectiveState),
      shouldConsumeLegacySource: false,
      state: effectiveState,
    };
  }

  const resolution = resolveToolbarProfileStateForProjectSwitch(localStorage, normalizedProjectId);
  const minimalIds = Array.isArray(resolution?.state?.toolbarProfiles?.minimal)
    ? resolution.state.toolbarProfiles.minimal
    : [];
  const shouldPersist = resolution?.shouldPersist !== false;
  const shouldConsumeLegacySource = Boolean(resolution?.shouldConsumeLegacySource);

  if (shouldConsumeLegacySource) {
    return {
      source: resolution.source || 'legacy',
      shouldPersist,
      shouldConsumeLegacySource,
      state: createToolbarConfiguratorState({
        activeToolbarProfile: TOOLBAR_CONFIGURATOR_DEFAULT_ACTIVE_PROFILE,
        toolbarProfiles: {
          minimal: minimalIds,
          master: createToolbarConfiguratorCanonicalProfileIds(),
        },
      }),
    };
  }

  return {
    source: resolution?.source || 'seed',
    shouldPersist,
    shouldConsumeLegacySource: false,
    state: createToolbarConfiguratorSeedState(),
  };
}

let configuratorBucketState = createToolbarConfiguratorSeedState();
let activeConfiguratorDragPayload = null;
let activeConfiguratorDragElement = null;
let activeConfiguratorBucketItemSelection = {
  bucketKey: '',
  itemId: '',
};
const AUTO_SAVE_DELAY = 600;
const HOTPATH_RENDER_DEBOUNCE_MS = 32;
const HOTPATH_FULL_RENDER_MIN_INTERVAL_MS = 280;
const HOTPATH_PAGINATION_IDLE_DELAY_MS = 220;
const HOTPATH_PAGINATION_IDLE_TIMEOUT_MS = 750;
const PAGINATION_MEASURE_BATCH_SIZE = 12;
const UI_ERROR_MAP_SCHEMA_VERSION = 'ui-error-map.v1';
const UI_ERROR_FALLBACK_MESSAGE = 'Операция не выполнена';
const UI_ERROR_FALLBACK_SEVERITY = 'ERROR';

const ZOOM_DEFAULT = 1.0;
const DEFAULT_ACTIVE_BOOK_PROFILE = createDefaultBookProfile();
const DEFAULT_PREVIEW_CHROME_STATE = createPreviewChromeState();
const DEFAULT_LAYOUT_PREVIEW_STATE = createLayoutPreviewState();

let activeBookProfileState = DEFAULT_ACTIVE_BOOK_PROFILE;
let activePreviewChromeState = DEFAULT_PREVIEW_CHROME_STATE;
let activeLayoutPreviewState = DEFAULT_LAYOUT_PREVIEW_STATE;
let layoutPreviewHost = null;
let layoutPreviewRefreshTimerId = null;

function getActivePreviewChrome(source = activePreviewChromeState) {
  return createPreviewChromeState(source);
}

function getActiveBookProfile(source = activeBookProfileState) {
  const normalizedResult = normalizeBookProfile(source);
  return normalizedResult.ok ? normalizedResult.value : DEFAULT_ACTIVE_BOOK_PROFILE;
}

function getPageMetrics({
  profile = activeBookProfileState,
  zoom = ZOOM_DEFAULT,
  pxPerMm = PX_PER_MM_AT_ZOOM_1,
} = {}) {
  const normalizedResult = normalizeBookProfile(profile);
  const resolvedProfile = normalizedResult.ok ? normalizedResult.value : DEFAULT_ACTIVE_BOOK_PROFILE;
  const metricsResult = resolvePageLayoutMetrics(resolvedProfile, {
    zoom,
    pxPerMm,
  });
  if (metricsResult.ok) {
    return metricsResult.value;
  }

  if (resolvedProfile === DEFAULT_ACTIVE_BOOK_PROFILE) {
    return null;
  }

  const fallbackResult = resolvePageLayoutMetrics(DEFAULT_ACTIVE_BOOK_PROFILE, {
    zoom: ZOOM_DEFAULT,
    pxPerMm: PX_PER_MM_AT_ZOOM_1,
  });
  if (!fallbackResult.ok) {
    return null;
  }

  return fallbackResult.value;
}

function applyPageGeometryCssVars(metrics) {
  if (!metrics) {
    return;
  }

  document.documentElement.style.setProperty('--page-width-px', `${Math.round(metrics.pageWidthPx)}px`);
  document.documentElement.style.setProperty('--page-height-px', `${Math.round(metrics.pageHeightPx)}px`);
  document.documentElement.style.setProperty('--page-margin-top-px', `${Math.round(metrics.marginTopPx)}px`);
  document.documentElement.style.setProperty('--page-margin-right-px', `${Math.round(metrics.marginRightPx)}px`);
  document.documentElement.style.setProperty('--page-margin-bottom-px', `${Math.round(metrics.marginBottomPx)}px`);
  document.documentElement.style.setProperty('--page-margin-left-px', `${Math.round(metrics.marginLeftPx)}px`);
}

function syncPreviewChromeFormatValue() {
  if (previewChromeFormatValueElement) {
    previewChromeFormatValueElement.textContent = getActiveBookProfile().formatId;
  }
}

function setActiveBookProfileFormat(formatId) {
  const nextProfileResult = normalizeBookProfile({
    ...activeBookProfileState,
    formatId,
  });
  if (!nextProfileResult.ok) {
    syncPreviewChromeFormatValue();
    return activeBookProfileState;
  }

  const nextProfile = nextProfileResult.value;
  if (nextProfile.formatId === activeBookProfileState.formatId) {
    syncPreviewChromeFormatValue();
    return nextProfile;
  }

  activeBookProfileState = nextProfile;
  const metrics = getPageMetrics({
    profile: activeBookProfileState,
    zoom: editorZoom,
  });
  if (metrics) {
    applyPageGeometryCssVars(metrics);
  }
  scheduleLayoutPreviewRefresh();
  syncPreviewChromeFormatValue();
  return nextProfile;
}

const initialPageMetrics = getPageMetrics({
  profile: activeBookProfileState,
  zoom: ZOOM_DEFAULT,
});
if (initialPageMetrics) {
  applyPageGeometryCssVars(initialPageMetrics);
}
applyPreviewChromeCssVars(activePreviewChromeState, document.documentElement, ZOOM_DEFAULT, PX_PER_MM_AT_ZOOM_1);
syncPreviewChromeFormatValue();

function ensureLayoutPreviewHost() {
  if (layoutPreviewHost) {
    return layoutPreviewHost;
  }
  if (!(mainContent instanceof HTMLElement)) {
    return null;
  }
  const host = document.createElement('aside');
  host.className = 'layout-preview-dock';
  host.hidden = true;
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-label', 'Layout preview');
  mainContent.appendChild(host);
  layoutPreviewHost = host;
  return layoutPreviewHost;
}

function clearLayoutPreviewHost() {
  const host = ensureLayoutPreviewHost();
  if (!host) {
    return;
  }
  host.replaceChildren();
}

function buildActiveLayoutPreviewSnapshot() {
  const metrics = getPageMetrics({
    profile: activeBookProfileState,
    zoom: editorZoom,
  });
  if (!metrics) {
    return null;
  }
  return buildLayoutPreviewSnapshot({
    text: getPlainText(),
    profile: getActiveBookProfile(),
    metrics,
    selectionRange: getSelectionOffsets(),
  });
}

function refreshLayoutPreviewNow() {
  const host = ensureLayoutPreviewHost();
  if (!host) {
    return;
  }
  if (!activeLayoutPreviewState.enabled || currentMode !== 'write') {
    clearLayoutPreviewHost();
    return;
  }
  const snapshot = buildActiveLayoutPreviewSnapshot();
  if (!snapshot) {
    clearLayoutPreviewHost();
    return;
  }
  renderLayoutPreviewSnapshot(host, snapshot, activeLayoutPreviewState);
}

function scheduleLayoutPreviewRefresh() {
  if (!activeLayoutPreviewState.enabled || currentMode !== 'write') {
    return;
  }
  if (layoutPreviewRefreshTimerId) {
    window.clearTimeout(layoutPreviewRefreshTimerId);
    layoutPreviewRefreshTimerId = null;
  }
  layoutPreviewRefreshTimerId = window.setTimeout(() => {
    layoutPreviewRefreshTimerId = null;
    refreshLayoutPreviewNow();
  }, 120);
}

function syncLayoutPreviewVisibility() {
  const host = ensureLayoutPreviewHost();
  if (!host) {
    return;
  }
  const shouldShow = activeLayoutPreviewState.enabled && currentMode === 'write';
  host.hidden = !shouldShow;
  if (mainContent instanceof HTMLElement) {
    mainContent.classList.toggle('is-layout-preview-visible', shouldShow);
  }
  if (!shouldShow) {
    clearLayoutPreviewHost();
    if (layoutPreviewRefreshTimerId) {
      window.clearTimeout(layoutPreviewRefreshTimerId);
      layoutPreviewRefreshTimerId = null;
    }
    return;
  }
  refreshLayoutPreviewNow();
}

function handleToggleLayoutPreview() {
  activeLayoutPreviewState = createLayoutPreviewState({
    ...activeLayoutPreviewState,
    enabled: !activeLayoutPreviewState.enabled,
  });
  syncLayoutPreviewVisibility();
  updateInspectorSnapshot();
  return {
    performed: true,
    enabled: activeLayoutPreviewState.enabled,
  };
}

function handleToggleLayoutPreviewFrame() {
  activeLayoutPreviewState = createLayoutPreviewState({
    ...activeLayoutPreviewState,
    frameMode: !activeLayoutPreviewState.frameMode,
  });
  if (activeLayoutPreviewState.enabled) {
    syncLayoutPreviewVisibility();
  }
  updateInspectorSnapshot();
  return {
    performed: true,
    frameMode: activeLayoutPreviewState.frameMode,
  };
}

function canStartFloatingToolbarDrag(target) {
  if (!target || !(target instanceof Element)) return false;
  return !target.closest('button, select, option, input, textarea, label');
}

function clampFloatingToolbarPosition(position, shellRect = toolbarShell?.getBoundingClientRect()) {
  if (!toolbarShell) {
    return position;
  }
  const minX = FLOATING_TOOLBAR_VISIBLE_STRIP_PX - shellRect.width;
  const maxX = window.innerWidth - FLOATING_TOOLBAR_VISIBLE_STRIP_PX;
  const minY = FLOATING_TOOLBAR_VISIBLE_STRIP_PX - shellRect.height;
  const maxY = window.innerHeight - FLOATING_TOOLBAR_VISIBLE_STRIP_PX;
  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function clampFloatingToolbarWidthScale(widthScale) {
  return Math.min(
    Math.max(widthScale, FLOATING_TOOLBAR_WIDTH_SCALE_MIN),
    FLOATING_TOOLBAR_WIDTH_SCALE_MAX
  );
}

function readFloatingToolbarState() {
  try {
    const raw = localStorage.getItem(FLOATING_TOOLBAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    const scale = Number(parsed.scale);
    const widthScale = Number(parsed.widthScale);
    const dockedWidthScale = Number(parsed.dockedWidthScale);
    const freeWidthScale = Number(parsed.freeWidthScale);
    const toolbarHeight = Number(parsed.toolbarHeight);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const resolvedWidthScale = Number.isFinite(widthScale) ? widthScale : 1;
    const resolvedDockedWidthScale = Number.isFinite(dockedWidthScale) ? dockedWidthScale : resolvedWidthScale;
    const resolvedFreeWidthScale = Number.isFinite(freeWidthScale) ? freeWidthScale : resolvedWidthScale;
    return {
      x,
      y,
      isVertical: Boolean(parsed.isVertical),
      isDetached: Boolean(parsed.isDetached),
      scale: Number.isFinite(scale) ? scale : 1,
      widthScale: Boolean(parsed.isDetached) ? resolvedFreeWidthScale : resolvedDockedWidthScale,
      dockedWidthScale: resolvedDockedWidthScale,
      freeWidthScale: resolvedFreeWidthScale,
      toolbarHeight: Number.isFinite(toolbarHeight) ? toolbarHeight : 0,
    };
  } catch {
    return null;
  }
}

function persistFloatingToolbarState() {
  try {
    localStorage.setItem(FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(floatingToolbarState));
  } catch {}
}

function readFloatingToolbarItemOffsets() {
  try {
    const raw = localStorage.getItem(FLOATING_TOOLBAR_ITEM_OFFSETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => Number.isFinite(Number(value)))
    );
  } catch {
    return {};
  }
}

function persistFloatingToolbarItemOffsets() {
  try {
    localStorage.setItem(FLOATING_TOOLBAR_ITEM_OFFSETS_STORAGE_KEY, JSON.stringify(toolbarItemOffsets));
  } catch {}
}

function getFloatingToolbarItemOffsetKey(item) {
  if (!(item instanceof HTMLElement)) return '';
  return item.dataset.toolbarItemKey || item.dataset.action || '';
}

function applyFloatingToolbarItemOffsets() {
  toolbarTunableItems.forEach((item) => {
    const key = getFloatingToolbarItemOffsetKey(item);
    const offset = floatingToolbarState.isDetached ? Number(toolbarItemOffsets[key] || 0) : 0;
    item.style.setProperty('--floating-toolbar-offset-x', `${offset}px`);
  });
  scheduleToolbarAnchorUpdate();
}

function setFloatingToolbarItemOffset(item, nextOffset, persist = true) {
  const key = getFloatingToolbarItemOffsetKey(item);
  if (!key) return;
  const roundedOffset = Math.round(nextOffset);
  const normalizedOffset = Math.abs(roundedOffset) <= FLOATING_TOOLBAR_ITEM_SNAP_THRESHOLD_PX ? 0 : roundedOffset;
  if (normalizedOffset === 0) {
    delete toolbarItemOffsets[key];
  } else {
    toolbarItemOffsets[key] = normalizedOffset;
  }
  applyFloatingToolbarItemOffsets();
  if (persist) {
    persistFloatingToolbarItemOffsets();
  }
}

function restoreFloatingToolbarItemOffsets() {
  toolbarItemOffsets = readFloatingToolbarItemOffsets();
  applyFloatingToolbarItemOffsets();
}

function stopFloatingToolbarItemOffsetDrag() {
  if (!toolbarItemOffsetDragState.active) return;
  const shouldReleaseClickSuppression = toolbarItemOffsetDragState.moved;
  if (toolbarItemOffsetDragState.item) {
    persistFloatingToolbarItemOffsets();
  }
  toolbarItemOffsetDragState = {
    active: false,
    item: null,
    key: '',
    startX: 0,
    originOffset: 0,
    moved: false,
  };
  if (shouldReleaseClickSuppression) {
    window.setTimeout(() => {
      toolbarItemSuppressClickOnce = false;
    }, 0);
  }
}

function setToolbarSpacingMenuOpen(nextOpen) {
  if (!toolbarSpacingMenu || !toolbarShell) return;
  if (!nextOpen) {
    toolbarSpacingMenu.hidden = true;
    return;
  }
  setParagraphMenuOpen(false);
  setListMenuOpen(false);
  setToolbarColorPickerOpen(false);
  setToolbarStylesMenuOpen(false);
  const shellRect = toolbarShell.getBoundingClientRect();
  const shellScale = Math.max(floatingToolbarState.scale || 1, 0.001);
  toolbarSpacingMenu.hidden = false;
  const menuRect = toolbarSpacingMenu.getBoundingClientRect();
  const clusterLeft = Number.parseFloat(toolbarShell.style.getPropertyValue('--floating-toolbar-cluster-left')) || 0;
  const clusterRight = Number.parseFloat(toolbarShell.style.getPropertyValue('--floating-toolbar-cluster-right')) || 0;
  const clusterBottom = Number.parseFloat(toolbarShell.style.getPropertyValue('--floating-toolbar-cluster-bottom')) || 0;
  const clusterCenterX = clusterLeft + ((clusterRight - clusterLeft) / 2);
  const desiredLeft = clusterCenterX - (menuRect.width / 2);
  const desiredTop = clusterBottom + 18;
  const maxLeft = Math.max(0, (shellRect.width / shellScale) - menuRect.width);
  const nextLeft = Math.round(Math.min(Math.max(desiredLeft, 0), maxLeft));
  const nextTop = Math.round(desiredTop);
  toolbarSpacingMenu.style.left = `${nextLeft}px`;
  toolbarSpacingMenu.style.top = `${nextTop}px`;
}

function setParagraphMenuOpen(nextOpen) {
  if (!paragraphMenu || !paragraphTriggerButton || !toolbarShell) return;
  if (!nextOpen) {
    paragraphMenu.hidden = true;
    paragraphTriggerButton.setAttribute('aria-expanded', 'false');
    return;
  }
  setToolbarSpacingMenuOpen(false);
  setListMenuOpen(false);
  setToolbarColorPickerOpen(false);
  setToolbarStylesMenuOpen(false);
  const shellRect = toolbarShell.getBoundingClientRect();
  const shellScale = Math.max(floatingToolbarState.scale || 1, 0.001);
  const triggerRect = paragraphTriggerButton.getBoundingClientRect();
  paragraphMenu.hidden = false;
  const menuRect = paragraphMenu.getBoundingClientRect();
  const desiredLeft = (triggerRect.left - shellRect.left) / shellScale;
  const desiredTop = ((triggerRect.bottom - shellRect.top) / shellScale) + 10;
  const maxLeft = Math.max(0, (shellRect.width / shellScale) - menuRect.width);
  const nextLeft = Math.round(Math.min(Math.max(desiredLeft, 0), maxLeft));
  const nextTop = Math.round(desiredTop);
  paragraphMenu.style.left = `${nextLeft}px`;
  paragraphMenu.style.top = `${nextTop}px`;
  paragraphTriggerButton.setAttribute('aria-expanded', 'true');
}

function setListMenuOpen(nextOpen) {
  if (!listMenu || !listTriggerButton || !toolbarShell) return;
  if (!nextOpen || !isTiptapMode) {
    listMenu.hidden = true;
    listTriggerButton.setAttribute('aria-expanded', 'false');
    return;
  }
  setParagraphMenuOpen(false);
  setToolbarSpacingMenuOpen(false);
  setToolbarColorPickerOpen(false);
  setToolbarStylesMenuOpen(false);
  const shellRect = toolbarShell.getBoundingClientRect();
  const shellScale = Math.max(floatingToolbarState.scale || 1, 0.001);
  const triggerRect = listTriggerButton.getBoundingClientRect();
  listMenu.hidden = false;
  const menuRect = listMenu.getBoundingClientRect();
  const desiredLeft = (triggerRect.left - shellRect.left) / shellScale;
  const desiredTop = ((triggerRect.bottom - shellRect.top) / shellScale) + 10;
  const maxLeft = Math.max(0, (shellRect.width / shellScale) - menuRect.width);
  const nextLeft = Math.round(Math.min(Math.max(desiredLeft, 0), maxLeft));
  const nextTop = Math.round(desiredTop);
  listMenu.style.left = `${nextLeft}px`;
  listMenu.style.top = `${nextTop}px`;
  listTriggerButton.setAttribute('aria-expanded', 'true');
}

function normalizeToolbarStylesMenuAnchor(anchor) {
  return anchor === TOOLBAR_STYLES_MENU_ANCHORS.character
    ? TOOLBAR_STYLES_MENU_ANCHORS.character
    : TOOLBAR_STYLES_MENU_ANCHORS.paragraph;
}

function getToolbarStylesAnchorButton(anchor) {
  return normalizeToolbarStylesMenuAnchor(anchor) === TOOLBAR_STYLES_MENU_ANCHORS.character
    ? styleCharacterButton
    : styleParagraphButton;
}

function setToolbarStylesMenuOpen(nextOpen, nextAnchor = toolbarStylesMenuState.anchor) {
  if (!toolbarStylesMenu || !toolbarShell) return;
  const anchor = normalizeToolbarStylesMenuAnchor(nextAnchor);
  if (!nextOpen) {
    toolbarStylesMenu.hidden = true;
    toolbarStylesMenu.setAttribute('aria-hidden', 'true');
    if (styleParagraphButton instanceof HTMLElement) {
      styleParagraphButton.setAttribute('aria-expanded', 'false');
    }
    if (styleCharacterButton instanceof HTMLElement) {
      styleCharacterButton.setAttribute('aria-expanded', 'false');
    }
    toolbarStylesMenuState = {
      ...toolbarStylesMenuState,
      open: false,
      anchor,
    };
    return;
  }
  setToolbarSpacingMenuOpen(false);
  setParagraphMenuOpen(false);
  setListMenuOpen(false);
  setToolbarColorPickerOpen(false);
  const anchorButton = getToolbarStylesAnchorButton(anchor);
  if (!(anchorButton instanceof HTMLElement)) return;
  const shellRect = toolbarShell.getBoundingClientRect();
  const shellScale = Math.max(floatingToolbarState.scale || 1, 0.001);
  const triggerRect = anchorButton.getBoundingClientRect();
  toolbarStylesMenu.hidden = false;
  toolbarStylesMenu.setAttribute('aria-hidden', 'false');
  const menuRect = toolbarStylesMenu.getBoundingClientRect();
  const rawLeft = (triggerRect.left - shellRect.left) / shellScale + ((triggerRect.width / shellScale - menuRect.width) / 2);
  const maxLeft = Math.max(0, (shellRect.width / shellScale) - menuRect.width);
  const nextLeft = Math.round(Math.min(Math.max(rawLeft, 0), maxLeft));
  const nextTop = Math.round(((triggerRect.bottom - shellRect.top) / shellScale) + 10);
  toolbarStylesMenu.style.left = `${nextLeft}px`;
  toolbarStylesMenu.style.top = `${nextTop}px`;
  toolbarStylesMenuState = {
    ...toolbarStylesMenuState,
    open: true,
    anchor,
  };
  if (styleParagraphButton instanceof HTMLElement) {
    styleParagraphButton.setAttribute('aria-expanded', anchor === TOOLBAR_STYLES_MENU_ANCHORS.paragraph ? 'true' : 'false');
  }
  if (styleCharacterButton instanceof HTMLElement) {
    styleCharacterButton.setAttribute('aria-expanded', anchor === TOOLBAR_STYLES_MENU_ANCHORS.character ? 'true' : 'false');
  }
}

function setToolbarSpacingTuningMode(nextActive) {
  toolbarSpacingTuningMode = Boolean(nextActive);
  if (toolbarShell) {
    toolbarShell.classList.toggle('is-spacing-tuning', toolbarSpacingTuningMode);
  }
  if (toolbarSpacingAction) {
    toolbarSpacingAction.textContent = toolbarSpacingTuningMode ? 'Завершить отступы' : 'Изменить отступы';
    toolbarSpacingAction.setAttribute('aria-pressed', toolbarSpacingTuningMode ? 'true' : 'false');
  }
  if (!toolbarSpacingTuningMode) {
    stopFloatingToolbarItemOffsetDrag();
  }
}

function updateToolbarAnchorVars() {
  if (!toolbarShell || !toolbarTunableItems.length) return;
  const shellRect = toolbarShell.getBoundingClientRect();
  const shellScale = Math.max(floatingToolbarState.scale || 1, 0.001);
  const itemRects = toolbarTunableItems
    .map((item) => item.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!itemRects.length) return;
  const bounds = itemRects.reduce((acc, rect) => ({
    left: Math.min(acc.left, rect.left),
    right: Math.max(acc.right, rect.right),
    top: Math.min(acc.top, rect.top),
    bottom: Math.max(acc.bottom, rect.bottom),
  }), {
    left: itemRects[0].left,
    right: itemRects[0].right,
    top: itemRects[0].top,
    bottom: itemRects[0].bottom,
  });
  const localLeft = (bounds.left - shellRect.left) / shellScale;
  const localRight = (bounds.right - shellRect.left) / shellScale;
  const localTop = (bounds.top - shellRect.top) / shellScale;
  const localBottom = (bounds.bottom - shellRect.top) / shellScale;
  toolbarShell.style.setProperty('--floating-toolbar-cluster-left', `${Math.round(localLeft)}px`);
  toolbarShell.style.setProperty('--floating-toolbar-cluster-right', `${Math.round(localRight)}px`);
  toolbarShell.style.setProperty('--floating-toolbar-cluster-top', `${Math.round(localTop)}px`);
  toolbarShell.style.setProperty('--floating-toolbar-cluster-bottom', `${Math.round(localBottom)}px`);
  toolbarShell.style.setProperty('--floating-toolbar-cluster-center-x', `${Math.round(localLeft + ((localRight - localLeft) / 2))}px`);
  toolbarShell.style.setProperty('--floating-toolbar-cluster-center-y', `${Math.round(localTop + ((localBottom - localTop) / 2))}px`);
  if (!toolbarSpacingMenu?.hidden) {
    setToolbarSpacingMenuOpen(true);
  } else if (!paragraphMenu?.hidden) {
    setParagraphMenuOpen(true);
  } else if (!listMenu?.hidden) {
    setListMenuOpen(true);
  } else if (!toolbarStylesMenu?.hidden) {
    setToolbarStylesMenuOpen(true, toolbarStylesMenuState.anchor);
  }
}

function scheduleToolbarAnchorUpdate() {
  if (toolbarAnchorFrameId) {
    cancelAnimationFrame(toolbarAnchorFrameId);
  }
  toolbarAnchorFrameId = requestAnimationFrame(() => {
    toolbarAnchorFrameId = 0;
    updateToolbarAnchorVars();
  });
}

function isMainToolbarAnchorHidden(anchor) {
  if (!(anchor instanceof HTMLElement)) return true;
  return anchor.hidden || anchor.getClientRects().length === 0;
}

function getVisibleToolbarBindKeys(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }
  const keys =
    snapshot.visibleBindKeys ||
    snapshot.visibleKeys ||
    snapshot.visibleToolbarBindKeys ||
    snapshot.bindKeys;
  return Array.isArray(keys) ? new Set(keys.filter((key) => typeof key === 'string' && key.length > 0)) : null;
}

function getCurrentMainToolbarRoot() {
  return document.querySelector('[data-toolbar]') || toolbar;
}

function closeOrphanedMainToolbarOverlays(snapshot) {
  const runtimeRegistry = snapshot?.registry && typeof snapshot.registry === 'object'
    ? snapshot.registry
    : toolbarRuntimeRegistry;
  const visibleBindKeys = getVisibleToolbarBindKeys(snapshot);
  const hasVisibleItems = !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    ? true
    : snapshot.hasVisibleItems !== false;
  const paragraphVisible = typeof snapshot?.paragraphTriggerVisible === 'boolean'
    ? snapshot.paragraphTriggerVisible
    : !hasVisibleItems
    ? false
    : visibleBindKeys
    ? (
      visibleBindKeys.has('paragraph-trigger')
      || visibleBindKeys.has('toolbar.paragraph.alignment')
      || visibleBindKeys.has('style-paragraph')
    )
    : !isMainToolbarAnchorHidden(runtimeRegistry?.paragraphTriggerButton || paragraphTriggerButton);
  const spacingVisible = hasVisibleItems;
  const listVisible = typeof snapshot?.listTriggerVisible === 'boolean'
    ? snapshot.listTriggerVisible
    : !hasVisibleItems
    ? false
    : visibleBindKeys
    ? visibleBindKeys.has('list-type')
    : !isMainToolbarAnchorHidden(runtimeRegistry?.listTriggerButton || listTriggerButton);

  const currentParagraphMenu = runtimeRegistry?.paragraphMenu || paragraphMenu;
  const currentParagraphTriggerButton = runtimeRegistry?.paragraphTriggerButton || paragraphTriggerButton;
  const currentListMenu = runtimeRegistry?.listMenu || listMenu;
  const currentListTriggerButton = runtimeRegistry?.listTriggerButton || listTriggerButton;
  const currentSpacingMenu = runtimeRegistry?.toolbarSpacingMenu || toolbarSpacingMenu;

  if (currentParagraphMenu && !currentParagraphMenu.hidden && !paragraphVisible) {
    currentParagraphMenu.hidden = true;
    if (currentParagraphTriggerButton && typeof currentParagraphTriggerButton.setAttribute === 'function') {
      currentParagraphTriggerButton.setAttribute('aria-expanded', 'false');
    }
  }
  if (currentListMenu && !currentListMenu.hidden && !listVisible) {
    currentListMenu.hidden = true;
    if (currentListTriggerButton && typeof currentListTriggerButton.setAttribute === 'function') {
      currentListTriggerButton.setAttribute('aria-expanded', 'false');
    }
  }
  if (currentSpacingMenu && !currentSpacingMenu.hidden && !spacingVisible) {
    currentSpacingMenu.hidden = true;
  }
}

function restoreFocusFromHiddenMainToolbarItem() {
  const activeElement = document.activeElement;
  const currentToolbar = getCurrentMainToolbarRoot();
  if (!(activeElement instanceof HTMLElement) || !(currentToolbar instanceof HTMLElement) || !currentToolbar.contains(activeElement)) {
    return;
  }
  const activeToolbarItem = activeElement.closest('[data-toolbar-item-key]');
  if (!(activeToolbarItem instanceof HTMLElement)) {
    return;
  }
  if (!activeToolbarItem.hidden && activeToolbarItem.getClientRects().length > 0) {
    return;
  }
  const focusResult = focusEditorSurface('current');
  if (focusResult && focusResult.performed !== false) {
    return;
  }
  if (typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
}

function projectMainFloatingToolbarRuntime(reason = 'projection') {
  const applyToolbarActiveProfile = typeof toolbarRuntimeProjectionModule.applyToolbarActiveProfile === 'function'
    ? toolbarRuntimeProjectionModule.applyToolbarActiveProfile
    : toolbarRuntimeProjectionModule.applyToolbarProfileMinimal;
  if (!toolbarRuntimeRegistry || typeof applyToolbarActiveProfile !== 'function') {
    return null;
  }
  const snapshot = applyToolbarActiveProfile(
    toolbarRuntimeRegistry,
    configuratorBucketState,
    {
      reason,
      currentProjectId,
      floatingToolbarState,
      toolbarItemOffsets,
    }
  );
  if (snapshot?.registry && snapshot.registry !== toolbarRuntimeRegistry) {
    toolbarRuntimeRegistry = snapshot.registry;
  }
  closeOrphanedMainToolbarOverlays(snapshot);
  restoreFocusFromHiddenMainToolbarItem();
  syncToolbarFormattingState();
  if (!snapshot || snapshot.anchorResyncRequired !== false) {
    scheduleToolbarAnchorUpdate();
  }
  return snapshot;
}

function getSnappedFloatingToolbarPosition(shellRect = toolbarShell?.getBoundingClientRect()) {
  const topBarRect = topWorkBar?.getBoundingClientRect();
  const shellWidth = shellRect?.width || 0;
  const shellHeight = shellRect?.height || 0;
  const baseY = topBarRect ? topBarRect.top + ((topBarRect.height - shellHeight) / 2) : 92;
  const baseX = topBarRect ? topBarRect.left + ((topBarRect.width - shellWidth) / 2) : (window.innerWidth - shellWidth) / 2;
  return clampFloatingToolbarPosition({
    x: baseX,
    y: baseY,
  }, shellRect);
}

function getSnappedFloatingToolbarX(nextX, shellRect = toolbarShell?.getBoundingClientRect()) {
  const topBarRect = topWorkBar?.getBoundingClientRect();
  if (!topBarRect) {
    return clampFloatingToolbarPosition({ x: nextX, y: floatingToolbarState.y }, shellRect).x;
  }
  const shellWidth = shellRect?.width || 0;
  const minX = topBarRect.left;
  const maxX = topBarRect.right - shellWidth;
  const centeredX = topBarRect.left + ((topBarRect.width - shellWidth) / 2);
  const clampedX = Math.min(Math.max(nextX, minX), maxX);
  if (Math.abs(clampedX - centeredX) <= FLOATING_TOOLBAR_CENTER_ANCHOR_PX) {
    return centeredX;
  }
  return clampedX;
}

function getDefaultFloatingToolbarState(shellRect = toolbarShell?.getBoundingClientRect()) {
  const snapped = getSnappedFloatingToolbarPosition(shellRect);
  const topBarRect = topWorkBar?.getBoundingClientRect();
  return {
    x: snapped.x,
    y: snapped.y,
    isVertical: false,
    isDetached: false,
    scale: 1,
    widthScale: 1,
    dockedWidthScale: 1,
    freeWidthScale: 1,
    toolbarHeight: Number.isFinite(topBarRect?.height) ? topBarRect.height : 0,
  };
}

function applyFloatingToolbarVisualState() {
  if (!toolbarShell) return;
  toolbarShell.style.setProperty('--floating-toolbar-scale', String(floatingToolbarState.scale));
  toolbarShell.style.setProperty(
    '--floating-toolbar-width-scale',
    String(floatingToolbarState.isDetached ? floatingToolbarState.freeWidthScale : floatingToolbarState.dockedWidthScale)
  );
  toolbarShell.classList.toggle('is-vertical', floatingToolbarState.isVertical);
  toolbarShell.classList.toggle('is-snapped', !floatingToolbarState.isDetached);
  scheduleToolbarAnchorUpdate();
}

function applyFloatingToolbarState(partialState, persist = true) {
  if (!toolbar) return;
  const shellRect = toolbarShell?.getBoundingClientRect();
  const nextPosition = clampFloatingToolbarPosition({
    x: partialState.x,
    y: partialState.y,
  }, shellRect);
  const nextIsDetached = Boolean(partialState.isDetached);
  const isModeTransition = nextIsDetached !== floatingToolbarState.isDetached;
  const providedWidthScale = Number.isFinite(partialState.widthScale)
    ? partialState.widthScale
    : floatingToolbarState.widthScale;
  let nextDockedWidthScale;
  let nextFreeWidthScale;
  if (isModeTransition) {
    if (nextIsDetached) {
      nextDockedWidthScale = clampFloatingToolbarWidthScale(
        Number.isFinite(partialState.dockedWidthScale)
          ? partialState.dockedWidthScale
          : floatingToolbarState.dockedWidthScale || providedWidthScale
      );
      nextFreeWidthScale = clampFloatingToolbarWidthScale(providedWidthScale);
    } else {
      nextDockedWidthScale = clampFloatingToolbarWidthScale(providedWidthScale);
      nextFreeWidthScale = clampFloatingToolbarWidthScale(
        Number.isFinite(partialState.freeWidthScale)
          ? partialState.freeWidthScale
          : floatingToolbarState.freeWidthScale || providedWidthScale
      );
    }
  } else {
    nextDockedWidthScale = clampFloatingToolbarWidthScale(
      Number.isFinite(partialState.dockedWidthScale)
        ? partialState.dockedWidthScale
        : (!nextIsDetached ? providedWidthScale : floatingToolbarState.dockedWidthScale || providedWidthScale)
    );
    nextFreeWidthScale = clampFloatingToolbarWidthScale(
      Number.isFinite(partialState.freeWidthScale)
        ? partialState.freeWidthScale
        : (nextIsDetached ? providedWidthScale : floatingToolbarState.freeWidthScale || providedWidthScale)
    );
  }
  floatingToolbarState = {
    x: nextPosition.x,
    y: nextPosition.y,
    isVertical: Boolean(partialState.isVertical),
    isDetached: nextIsDetached,
    scale: Math.min(Math.max(partialState.scale, FLOATING_TOOLBAR_SCALE_MIN), FLOATING_TOOLBAR_SCALE_MAX),
    widthScale: nextIsDetached ? nextFreeWidthScale : nextDockedWidthScale,
    dockedWidthScale: nextDockedWidthScale,
    freeWidthScale: nextFreeWidthScale,
    toolbarHeight: Number.isFinite(partialState.toolbarHeight) ? partialState.toolbarHeight : 0,
  };
  toolbar.style.left = `${Math.round(floatingToolbarState.x)}px`;
  toolbar.style.top = `${Math.round(floatingToolbarState.y)}px`;
  toolbar.style.transform = 'none';
  if (persist) {
    persistFloatingToolbarState();
  }
  applyFloatingToolbarVisualState();
  applyFloatingToolbarItemOffsets();
  scheduleToolbarAnchorUpdate();
}

function restoreFloatingToolbarPosition() {
  if (!toolbarShell) return;
  const saved = readFloatingToolbarState();
  applyFloatingToolbarState(saved || getDefaultFloatingToolbarState(), Boolean(saved));
}

function clampLeftFloatingToolbarPosition(position, shellRect = leftToolbarShell?.getBoundingClientRect()) {
  if (!leftToolbarShell) {
    return position;
  }
  const minX = FLOATING_TOOLBAR_VISIBLE_STRIP_PX - shellRect.width;
  const maxX = window.innerWidth - FLOATING_TOOLBAR_VISIBLE_STRIP_PX;
  const minY = FLOATING_TOOLBAR_VISIBLE_STRIP_PX - shellRect.height;
  const maxY = window.innerHeight - FLOATING_TOOLBAR_VISIBLE_STRIP_PX;
  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function readLeftFloatingToolbarState() {
  try {
    const raw = localStorage.getItem(LEFT_FLOATING_TOOLBAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    const scale = Number(parsed.scale);
    const widthScale = Number(parsed.widthScale);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      x,
      y,
      isVertical: Boolean(parsed.isVertical),
      isDetached: Boolean(parsed.isDetached),
      scale: Number.isFinite(scale) ? scale : 1,
      widthScale: Number.isFinite(widthScale) ? widthScale : 1,
    };
  } catch {
    return null;
  }
}

function persistLeftFloatingToolbarState() {
  try {
    localStorage.setItem(LEFT_FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(leftFloatingToolbarState));
  } catch {}
}

function readLeftToolbarButtonOffsets() {
  try {
    const raw = localStorage.getItem(LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => Number.isFinite(Number(value)))
    );
  } catch {
    return {};
  }
}

function persistLeftToolbarButtonOffsets() {
  try {
    localStorage.setItem(LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY, JSON.stringify(leftToolbarButtonOffsets));
  } catch {}
}

function getLeftToolbarButtonOffsetKey(button) {
  if (!(button instanceof HTMLElement)) return '';
  return button.dataset.action || '';
}

function applyLeftToolbarButtonOffsets() {
  leftToolbarButtons.forEach((button) => {
    const key = getLeftToolbarButtonOffsetKey(button);
    const offset = Number(leftToolbarButtonOffsets[key] || 0);
    button.style.setProperty('--work-bar-offset-x', `${offset}px`);
  });
  scheduleLeftToolbarAnchorUpdate();
}

function setLeftToolbarButtonOffset(button, nextOffset, persist = true) {
  const key = getLeftToolbarButtonOffsetKey(button);
  if (!key) return;
  const normalizedOffset = Math.round(nextOffset);
  if (normalizedOffset === 0) {
    delete leftToolbarButtonOffsets[key];
  } else {
    leftToolbarButtonOffsets[key] = normalizedOffset;
  }
  applyLeftToolbarButtonOffsets();
  if (persist) {
    persistLeftToolbarButtonOffsets();
  }
}

function restoreLeftToolbarButtonOffsets() {
  leftToolbarButtonOffsets = readLeftToolbarButtonOffsets();
  applyLeftToolbarButtonOffsets();
}

function stopLeftToolbarButtonOffsetDrag() {
  if (!leftToolbarButtonOffsetDragState.active) return;
  const shouldReleaseClickSuppression = leftToolbarButtonOffsetDragState.moved;
  if (leftToolbarButtonOffsetDragState.button) {
    persistLeftToolbarButtonOffsets();
  }
  leftToolbarButtonOffsetDragState = {
    active: false,
    button: null,
    action: '',
    startX: 0,
    originOffset: 0,
    moved: false,
  };
  if (shouldReleaseClickSuppression) {
    window.setTimeout(() => {
      leftToolbarButtonSuppressClickOnce = false;
    }, 0);
  }
}

function setLeftToolbarSpacingMenuOpen(nextOpen, position = null) {
  if (!leftToolbarSpacingMenu || !leftToolbarShell) return;
  if (!nextOpen) {
    leftToolbarSpacingMenu.hidden = true;
    return;
  }
  const shellRect = leftToolbarShell.getBoundingClientRect();
  const clusterRect = leftToolbarCluster?.getBoundingClientRect();
  leftToolbarSpacingMenu.hidden = false;
  const menuRect = leftToolbarSpacingMenu.getBoundingClientRect();
  const shellScale = Math.max(leftFloatingToolbarState.scale || 1, 0.001);
  const clusterLeft = clusterRect ? (clusterRect.left - shellRect.left) / shellScale : 0;
  const clusterRight = clusterRect ? (clusterRect.right - shellRect.left) / shellScale : 0;
  const clusterBottom = clusterRect ? (clusterRect.bottom - shellRect.top) / shellScale : 0;
  const clusterCenterX = clusterLeft + ((clusterRight - clusterLeft) / 2);
  const desiredLeft = clusterCenterX - (menuRect.width / 2);
  const desiredTop = clusterBottom + 18;
  const nextLeft = Math.round(desiredLeft);
  const nextTop = Math.round(desiredTop);
  leftToolbarSpacingMenu.style.left = `${nextLeft}px`;
  leftToolbarSpacingMenu.style.top = `${nextTop}px`;
}

function setLeftToolbarSpacingTuningMode(nextActive) {
  leftToolbarSpacingTuningMode = Boolean(nextActive);
  if (leftToolbarShell) {
    leftToolbarShell.classList.toggle('is-spacing-tuning', leftToolbarSpacingTuningMode);
  }
  if (leftToolbarSpacingAction) {
    leftToolbarSpacingAction.textContent = leftToolbarSpacingTuningMode ? 'Завершить отступы' : 'Изменить отступы';
    leftToolbarSpacingAction.setAttribute('aria-pressed', leftToolbarSpacingTuningMode ? 'true' : 'false');
  }
  if (!leftToolbarSpacingTuningMode) {
    stopLeftToolbarButtonOffsetDrag();
  }
}

function updateLeftToolbarAnchorVars() {
  if (!leftToolbarShell || !leftToolbarButtons.length) return;
  const shellRect = leftToolbarShell.getBoundingClientRect();
  const shellScale = Math.max(leftFloatingToolbarState.scale || 1, 0.001);
  const buttonRects = leftToolbarButtons
    .map((button) => button.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!buttonRects.length) return;
  const bounds = buttonRects.reduce((acc, rect) => ({
    left: Math.min(acc.left, rect.left),
    right: Math.max(acc.right, rect.right),
    top: Math.min(acc.top, rect.top),
    bottom: Math.max(acc.bottom, rect.bottom),
  }), {
    left: buttonRects[0].left,
    right: buttonRects[0].right,
    top: buttonRects[0].top,
    bottom: buttonRects[0].bottom,
  });
  const localLeft = (bounds.left - shellRect.left) / shellScale;
  const localRight = (bounds.right - shellRect.left) / shellScale;
  const localTop = (bounds.top - shellRect.top) / shellScale;
  const localBottom = (bounds.bottom - shellRect.top) / shellScale;
  leftToolbarShell.style.setProperty('--left-toolbar-cluster-left', `${Math.round(localLeft)}px`);
  leftToolbarShell.style.setProperty('--left-toolbar-cluster-right', `${Math.round(localRight)}px`);
  leftToolbarShell.style.setProperty('--left-toolbar-cluster-top', `${Math.round(localTop)}px`);
  leftToolbarShell.style.setProperty('--left-toolbar-cluster-bottom', `${Math.round(localBottom)}px`);
  leftToolbarShell.style.setProperty('--left-toolbar-cluster-center-x', `${Math.round(localLeft + ((localRight - localLeft) / 2))}px`);
  leftToolbarShell.style.setProperty('--left-toolbar-cluster-center-y', `${Math.round(localTop + ((localBottom - localTop) / 2))}px`);
}

function scheduleLeftToolbarAnchorUpdate() {
  if (leftToolbarAnchorFrameId) {
    cancelAnimationFrame(leftToolbarAnchorFrameId);
  }
  leftToolbarAnchorFrameId = requestAnimationFrame(() => {
    leftToolbarAnchorFrameId = 0;
    updateLeftToolbarAnchorVars();
  });
}

function getSnappedLeftFloatingToolbarPosition(shellRect = leftToolbarShell?.getBoundingClientRect()) {
  const topBarRect = topWorkBar?.getBoundingClientRect();
  const shellWidth = shellRect?.width || 0;
  const shellHeight = shellRect?.height || 0;
  const baseY = topBarRect ? topBarRect.top + ((topBarRect.height - shellHeight) / 2) : 92;
  const baseX = topBarRect ? topBarRect.left + 24 : 24;
  return clampLeftFloatingToolbarPosition({
    x: baseX,
    y: baseY,
  }, shellRect);
}

function getDefaultLeftFloatingToolbarState(shellRect = leftToolbarShell?.getBoundingClientRect()) {
  const snapped = getSnappedLeftFloatingToolbarPosition(shellRect);
  return {
    x: snapped.x,
    y: snapped.y,
    isVertical: false,
    isDetached: false,
    scale: 1,
    widthScale: 1,
  };
}

function applyLeftFloatingToolbarVisualState() {
  if (!leftToolbarShell) return;
  leftToolbarShell.style.setProperty('--left-toolbar-scale', String(leftFloatingToolbarState.scale));
  leftToolbarShell.style.setProperty('--left-toolbar-width-scale', String(leftFloatingToolbarState.widthScale));
  leftToolbarShell.classList.toggle('is-vertical', leftFloatingToolbarState.isVertical);
  leftToolbarShell.classList.toggle('is-snapped', !leftFloatingToolbarState.isDetached);
  scheduleLeftToolbarAnchorUpdate();
}

function applyLeftFloatingToolbarState(partialState, persist = true) {
  if (!leftToolbar) return;
  const shellRect = leftToolbarShell?.getBoundingClientRect();
  const nextPosition = clampLeftFloatingToolbarPosition({
    x: partialState.x,
    y: partialState.y,
  }, shellRect);
  leftFloatingToolbarState = {
    x: nextPosition.x,
    y: nextPosition.y,
    isVertical: Boolean(partialState.isVertical),
    isDetached: Boolean(partialState.isDetached),
    scale: Math.min(Math.max(partialState.scale, FLOATING_TOOLBAR_SCALE_MIN), FLOATING_TOOLBAR_SCALE_MAX),
    widthScale: Math.min(
      Math.max(partialState.widthScale, FLOATING_TOOLBAR_WIDTH_SCALE_MIN),
      FLOATING_TOOLBAR_WIDTH_SCALE_MAX
    ),
  };
  leftToolbar.style.left = `${Math.round(leftFloatingToolbarState.x)}px`;
  leftToolbar.style.top = `${Math.round(leftFloatingToolbarState.y)}px`;
  leftToolbar.style.transform = 'none';
  if (persist) {
    persistLeftFloatingToolbarState();
  }
  applyLeftFloatingToolbarVisualState();
}

function restoreLeftFloatingToolbarPosition() {
  if (!leftToolbarShell) return;
  const saved = readLeftFloatingToolbarState();
  applyLeftFloatingToolbarState(saved || getDefaultLeftFloatingToolbarState(), Boolean(saved));
  scheduleLeftToolbarAnchorUpdate();
}

function updateLeftTransformingClass() {
  if (!leftToolbarShell) return;
  leftToolbarShell.classList.toggle('is-transforming', Boolean(leftFloatingToolbarInteractionState.mode));
}

function setLeftFloatingToolbarHandlesVisible(nextVisible) {
  if (!leftToolbarShell) return;
  leftFloatingToolbarHandlesVisible = Boolean(nextVisible);
  leftToolbarShell.classList.toggle('is-handles-visible', leftFloatingToolbarHandlesVisible);
}

function startLeftFloatingToolbarInteraction(mode, event) {
  if (!leftToolbarShell) return;
  if (mode === 'move' && !canStartFloatingToolbarDrag(event.target)) {
    return;
  }
  event.preventDefault();
  if (mode === 'move' && event.altKey) {
    return;
  }
  leftFloatingToolbarInteractionState = {
    mode,
    active: false,
    startX: event.clientX,
    startY: event.clientY,
    origin: { ...leftFloatingToolbarState },
  };
  updateLeftTransformingClass();
}

function stopLeftFloatingToolbarInteraction() {
  if (!leftToolbarShell) return;
  if (leftFloatingToolbarInteractionState.mode) {
    persistLeftFloatingToolbarState();
  }
  leftFloatingToolbarInteractionState = {
    mode: null,
    active: false,
    startX: 0,
    startY: 0,
    origin: null,
  };
  leftToolbarShell.classList.remove('is-dragging');
  updateLeftTransformingClass();
}

function initializeLeftToolbarButtonOffsetTuning() {
  if (!leftToolbarButtons.length) return;
  restoreLeftToolbarButtonOffsets();
  leftToolbarButtons.forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      // Keep button click handling independent from toolbar drag foundation.
      event.stopPropagation();
    });
    button.addEventListener('mousedown', (event) => {
      const tuningIntent = leftToolbarSpacingTuningMode || event.altKey;
      if (event.button !== 0 || !tuningIntent) return;
      const key = getLeftToolbarButtonOffsetKey(button);
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      leftToolbarButtonOffsetDragState = {
        active: true,
        button,
        action: key,
        startX: event.clientX,
        originOffset: Number(leftToolbarButtonOffsets[key] || 0),
        moved: false,
      };
    });
    button.addEventListener('dblclick', (event) => {
      if (!leftToolbarSpacingTuningMode && !event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      setLeftToolbarButtonOffset(button, 0);
      leftFloatingToolbarSuppressClickOnce = true;
    });
  });

  document.addEventListener('mousemove', (event) => {
    if (!leftToolbarButtonOffsetDragState.active || !leftToolbarButtonOffsetDragState.button) return;
    const deltaX = event.clientX - leftToolbarButtonOffsetDragState.startX;
    if (!leftToolbarButtonOffsetDragState.moved && Math.abs(deltaX) >= 1) {
      leftToolbarButtonOffsetDragState.moved = true;
      leftFloatingToolbarSuppressClickOnce = true;
      leftToolbarButtonSuppressClickOnce = true;
    }
    setLeftToolbarButtonOffset(
      leftToolbarButtonOffsetDragState.button,
      leftToolbarButtonOffsetDragState.originOffset + deltaX,
      false
    );
    event.preventDefault();
  });

  document.addEventListener('mouseup', () => {
    stopLeftToolbarButtonOffsetDrag();
  });
}

function initializeLeftToolbarActionButtons() {
  if (!leftToolbarCluster) return;
  let pressedButton = null;

  const resolveActionButton = (eventTarget) => {
    if (!(eventTarget instanceof Element)) return null;
    const button = eventTarget.closest('[data-left-action]');
    if (!(button instanceof HTMLElement)) return null;
    if (!leftToolbarCluster.contains(button)) return null;
    return button;
  };

  const clearPressedState = () => {
    if (!pressedButton) return;
    pressedButton.classList.remove('is-pressed');
    pressedButton = null;
  };

  leftToolbarCluster.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.altKey || leftToolbarSpacingTuningMode) return;
    const button = resolveActionButton(event.target);
    if (!button) return;
    clearPressedState();
    pressedButton = button;
    button.classList.add('is-pressed');
  }, true);

  document.addEventListener('pointerup', () => {
    if (!pressedButton) return;
    clearPressedState();
  });

  document.addEventListener('pointercancel', () => {
    clearPressedState();
  });

  leftToolbarCluster.addEventListener('click', (event) => {
    const button = resolveActionButton(event.target);
    if (!button) return;
    if (event.altKey || leftToolbarSpacingTuningMode) return;
    if (leftFloatingToolbarSuppressClickOnce || leftToolbarButtonSuppressClickOnce) {
      leftFloatingToolbarSuppressClickOnce = false;
      leftToolbarButtonSuppressClickOnce = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const action = button.dataset.leftAction || button.dataset.action || '';
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    triggerLeftToolbarAction(action);
  }, true);
}

function initializeLeftToolbarSpacingMenu() {
  if (!leftToolbarCluster || !leftToolbarSpacingMenu || !leftToolbarSpacingAction) return;
  setLeftToolbarSpacingTuningMode(false);
  leftToolbarCluster.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-left-toolbar-rotate-handle], [data-left-toolbar-width-handle], [data-left-toolbar-scale-handle]')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setLeftToolbarSpacingMenuOpen(true, { x: event.clientX, y: event.clientY });
    leftToolbarSpacingAction.focus();
  });
  leftToolbarSpacingAction.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLeftToolbarSpacingTuningMode(!leftToolbarSpacingTuningMode);
    setLeftToolbarSpacingMenuOpen(false);
  });
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!leftToolbarSpacingMenu.contains(target)) {
      setLeftToolbarSpacingMenuOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setLeftToolbarSpacingMenuOpen(false);
      if (leftToolbarSpacingTuningMode) {
        setLeftToolbarSpacingTuningMode(false);
      }
    }
  });
}

function initializeLeftFloatingToolbarDragFoundation() {
  if (!leftToolbarShell) return;
  leftToolbarShell.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    startLeftFloatingToolbarInteraction('move', event);
  });
  leftToolbarRotateHandles.forEach((handle) => {
    handle.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    handle.addEventListener('click', (event) => {
      event.stopPropagation();
      applyLeftFloatingToolbarState({
        ...leftFloatingToolbarState,
        isVertical: !leftFloatingToolbarState.isVertical,
      });
    });
  });
  leftToolbarWidthHandle?.addEventListener('mousedown', (event) => {
    event.stopPropagation();
    startLeftFloatingToolbarInteraction('width', event);
  });
  leftToolbarScaleHandle?.addEventListener('mousedown', (event) => {
    event.stopPropagation();
    startLeftFloatingToolbarInteraction('scale', event);
  });

  document.addEventListener('mousemove', (event) => {
    const { mode, origin } = leftFloatingToolbarInteractionState;
    if (!mode || !origin || !leftToolbarShell) return;
    const deltaX = event.clientX - leftFloatingToolbarInteractionState.startX;
    const deltaY = event.clientY - leftFloatingToolbarInteractionState.startY;
    if (mode === 'move') {
      if (!leftFloatingToolbarInteractionState.active) {
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < FLOATING_TOOLBAR_DRAG_THRESHOLD_PX) {
          return;
        }
        leftFloatingToolbarInteractionState.active = true;
        leftFloatingToolbarSuppressClickOnce = true;
        leftToolbarShell.classList.add('is-dragging');
      }
      const topBarRect = topWorkBar?.getBoundingClientRect();
      const pointerNearSnapZone = Boolean(
        topBarRect &&
        event.clientY >= topBarRect.top - FLOATING_TOOLBAR_SNAP_ZONE_PX &&
        event.clientY <= topBarRect.bottom + FLOATING_TOOLBAR_SNAP_ZONE_PX
      );
      if (pointerNearSnapZone) {
        const shellRect = leftToolbarShell.getBoundingClientRect();
        const snapped = getSnappedLeftFloatingToolbarPosition(shellRect);
        const shellWidth = shellRect?.width || 0;
        const minX = topBarRect.left;
        const maxX = topBarRect.right - shellWidth;
        applyLeftFloatingToolbarState({
          ...origin,
          x: Math.min(Math.max(origin.x + deltaX, minX), maxX),
          y: snapped.y,
          isDetached: false,
        }, false);
      } else {
        applyLeftFloatingToolbarState({
          ...origin,
          x: origin.x + deltaX,
          y: origin.y + deltaY,
          isDetached: true,
        }, false);
      }
    } else if (mode === 'width') {
      leftFloatingToolbarInteractionState.active = true;
      applyLeftFloatingToolbarState({
        ...origin,
        widthScale: origin.widthScale + (deltaX * 0.01),
      }, false);
    } else if (mode === 'scale') {
      leftFloatingToolbarInteractionState.active = true;
      applyLeftFloatingToolbarState({
        ...origin,
        scale: origin.scale + (deltaX * 0.01),
      }, false);
    }
    event.preventDefault();
  });

  document.addEventListener('mouseup', () => {
    if (!leftFloatingToolbarInteractionState.mode) return;
    stopLeftFloatingToolbarInteraction();
  });

  leftToolbarShell.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (leftFloatingToolbarSuppressClickOnce) {
      leftFloatingToolbarSuppressClickOnce = false;
      return;
    }
    if (target.closest('button, select, option, input, textarea, label, [data-left-toolbar-rotate-handle], [data-left-toolbar-width-handle], [data-left-toolbar-scale-handle]')) {
      return;
    }
    setLeftFloatingToolbarHandlesVisible(!leftFloatingToolbarHandlesVisible);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!leftToolbarShell.contains(target)) {
      setLeftFloatingToolbarHandlesVisible(false);
    }
  });

  window.addEventListener('resize', () => {
    restoreLeftFloatingToolbarPosition();
    scheduleLeftToolbarAnchorUpdate();
  });

  requestAnimationFrame(() => {
    restoreLeftFloatingToolbarPosition();
    scheduleLeftToolbarAnchorUpdate();
  });
}

function setConfiguratorOpen(nextOpen) {
  if (!configuratorPanel) return;
  if (!nextOpen) {
    clearToolbarConfiguratorBucketItemSelection(true);
  }
  configuratorPanel.hidden = !nextOpen;
  if (gridTriggerButton) {
    gridTriggerButton.classList.toggle('is-active', nextOpen);
    gridTriggerButton.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    gridTriggerButton.setAttribute('aria-pressed', nextOpen ? 'true' : 'false');
  }
}

function toggleConfiguratorOpen() {
  if (!configuratorPanel) return false;
  const nextOpen = configuratorPanel.hidden;
  setConfiguratorOpen(nextOpen);
  return nextOpen;
}

function writeConfiguratorDragPayload(event, payload) {
  if (!event.dataTransfer) return false;
  try {
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
  } catch {}
  event.dataTransfer.setData('text/plain', payload.itemId || '');
  return true;
}

function readConfiguratorDragPayload(event) {
  if (activeConfiguratorDragPayload) {
    return activeConfiguratorDragPayload;
  }
  const raw = event.dataTransfer?.getData('application/json') || '';
  if (!raw) {
    const itemId = event.dataTransfer?.getData('text/plain')?.trim() || '';
    return itemId ? { sourceType: 'library-item', itemId } : null;
  }
  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}

function getToolbarConfiguratorCatalogItem(itemId) {
  const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
  if (!normalizedItemId) return null;
  return getToolbarFunctionCatalogEntryById(normalizedItemId) || null;
}

function getToolbarConfiguratorEntryPanelLabel(entry) {
  const ruLabels = entry?.labels?.ru || null;
  const enLabels = entry?.labels?.en || null;
  return ruLabels?.panelLabel || enLabels?.panelLabel || entry?.id || '';
}

function getToolbarConfiguratorEntryAriaLabel(entry) {
  const ruLabels = entry?.labels?.ru || null;
  const enLabels = entry?.labels?.en || null;
  return ruLabels?.ariaLabel || ruLabels?.panelLabel || enLabels?.ariaLabel || enLabels?.panelLabel || entry?.id || '';
}

function getToolbarConfiguratorActiveProfile() {
  return normalizeToolbarConfiguratorProfileName(configuratorBucketState?.activeToolbarProfile);
}

function getToolbarConfiguratorProfileIds(profileName = getToolbarConfiguratorActiveProfile()) {
  const normalizedProfileName = normalizeToolbarConfiguratorProfileName(profileName);
  const profileIds = configuratorBucketState?.toolbarProfiles?.[normalizedProfileName];
  return Array.isArray(profileIds) ? profileIds : [];
}

function createToolbarConfiguratorBucketItemSelection(bucketKey = '', itemId = '') {
  const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
  const normalizedBucketKey = TOOLBAR_CONFIGURATOR_PROFILE_NAMES.includes(bucketKey) ? bucketKey : '';
  if (!normalizedBucketKey || !normalizedItemId) {
    return {
      bucketKey: '',
      itemId: '',
    };
  }
  return {
    bucketKey: normalizedBucketKey,
    itemId: normalizedItemId,
  };
}

function isToolbarConfiguratorBucketItemSelected(bucketKey, itemId) {
  const normalizedSelection = createToolbarConfiguratorBucketItemSelection(bucketKey, itemId);
  return Boolean(normalizedSelection.itemId)
    && activeConfiguratorBucketItemSelection.bucketKey === normalizedSelection.bucketKey
    && activeConfiguratorBucketItemSelection.itemId === normalizedSelection.itemId;
}

function clearToolbarConfiguratorBucketItemSelection(shouldRender = false) {
  const hadSelection = Boolean(
    activeConfiguratorBucketItemSelection.bucketKey
    || activeConfiguratorBucketItemSelection.itemId
  );
  activeConfiguratorBucketItemSelection = {
    bucketKey: '',
    itemId: '',
  };
  if (shouldRender && hadSelection) {
    renderToolbarConfiguratorBuckets();
  }
  return hadSelection;
}

function reconcileToolbarConfiguratorBucketItemSelection() {
  const { bucketKey, itemId } = activeConfiguratorBucketItemSelection;
  if (!bucketKey || !itemId) {
    return false;
  }
  if (getToolbarConfiguratorProfileIds(bucketKey).includes(itemId)) {
    return false;
  }
  clearToolbarConfiguratorBucketItemSelection(false);
  return true;
}

function setToolbarConfiguratorBucketItemSelection(bucketKey, itemId, shouldRender = true) {
  const nextSelection = createToolbarConfiguratorBucketItemSelection(bucketKey, itemId);
  const didChange = nextSelection.bucketKey !== activeConfiguratorBucketItemSelection.bucketKey
    || nextSelection.itemId !== activeConfiguratorBucketItemSelection.itemId;
  if (!didChange) {
    return false;
  }
  activeConfiguratorBucketItemSelection = nextSelection;
  if (shouldRender) {
    renderToolbarConfiguratorBuckets();
  }
  return true;
}

function getToolbarConfiguratorBucketItems(bucket) {
  if (!(bucket instanceof HTMLElement)) return [];
  return Array.from(bucket.querySelectorAll('.configurator-panel__bucket-item[data-item-id]'));
}

function listToolbarConfiguratorLibraryEntries() {
  const activeProfile = getToolbarConfiguratorActiveProfile();
  const activeProfileIds = new Set(getToolbarConfiguratorProfileIds(activeProfile));
  return listLiveToolbarFunctionCatalogEntries().filter((entry) => !activeProfileIds.has(entry.id));
}

function getToolbarConfiguratorLibraryColumns(entries = listToolbarConfiguratorLibraryEntries()) {
  const safeEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const slotCount = Math.max(
    TOOLBAR_CONFIGURATOR_LIBRARY_MIN_SLOT_COUNT,
    Math.ceil(safeEntries.length / TOOLBAR_CONFIGURATOR_LIBRARY_COLUMN_COUNT) * TOOLBAR_CONFIGURATOR_LIBRARY_COLUMN_COUNT,
  );
  const columns = Array.from({ length: TOOLBAR_CONFIGURATOR_LIBRARY_COLUMN_COUNT }, () => []);
  for (let index = 0; index < slotCount; index += 1) {
    const entry = safeEntries[index] || null;
    columns[index % TOOLBAR_CONFIGURATOR_LIBRARY_COLUMN_COUNT].push(entry
      ? {
          kind: 'item',
          itemId: entry.id,
          entry,
        }
      : {
          kind: 'placeholder',
          itemId: '',
          label: TOOLBAR_CONFIGURATOR_LIBRARY_PLACEHOLDER_TEXT,
          slotIndex: index,
        });
  }
  return columns;
}

function isToolbarConfiguratorProtectedBucket(bucketKey) {
  return normalizeToolbarConfiguratorProfileName(bucketKey) === 'master';
}

function getToolbarConfiguratorBucketDropIntent(payload, bucketKey) {
  const normalizedItemId = typeof payload?.itemId === 'string' ? payload.itemId.trim() : '';
  if (!normalizedItemId) return null;

  const targetBucketKey = normalizeToolbarConfiguratorProfileName(bucketKey);
  if (payload?.sourceType !== 'bucket-item') {
    return targetBucketKey === 'minimal' || targetBucketKey === 'master' ? 'insert' : null;
  }

  const sourceBucketKey = normalizeToolbarConfiguratorProfileName(payload.bucketKey || '');
  if (sourceBucketKey === targetBucketKey) {
    return 'reorder';
  }
  if (sourceBucketKey === 'master' && targetBucketKey === 'minimal') {
    return 'copy-from-master';
  }
  if (sourceBucketKey === 'minimal' && targetBucketKey === 'master') {
    return 'return-to-master';
  }
  return null;
}

function moveToolbarConfiguratorItemWithinBucket(itemIds, itemId, insertionIndex) {
  const nextIds = Array.isArray(itemIds) ? [...itemIds] : [];
  const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
  const currentIndex = nextIds.indexOf(normalizedItemId);
  if (!normalizedItemId || currentIndex < 0) return null;

  nextIds.splice(currentIndex, 1);
  let nextInsertIndex = Math.min(
    Math.max(Number.isFinite(insertionIndex) ? Math.trunc(insertionIndex) : nextIds.length, 0),
    nextIds.length,
  );
  nextIds.splice(nextInsertIndex, 0, normalizedItemId);
  return nextIds.join('\u0000') === itemIds.join('\u0000') ? null : nextIds;
}

function insertToolbarConfiguratorItemIntoBucket(itemIds, itemId, insertionIndex) {
  const nextIds = Array.isArray(itemIds) ? [...itemIds] : [];
  const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
  if (!normalizedItemId) return null;

  const currentIndex = nextIds.indexOf(normalizedItemId);
  if (currentIndex >= 0) {
    nextIds.splice(currentIndex, 1);
  }
  let nextInsertIndex = Math.min(
    Math.max(Number.isFinite(insertionIndex) ? Math.trunc(insertionIndex) : nextIds.length, 0),
    nextIds.length,
  );
  nextIds.splice(nextInsertIndex, 0, normalizedItemId);
  return nextIds.join('\u0000') === itemIds.join('\u0000') ? null : nextIds;
}

function resolveToolbarConfiguratorInterBucketTransfer(state, payload, bucketKey, insertionIndex) {
  const normalizedState = isPlainObject(state) ? state : createToolbarConfiguratorSeedState();
  const normalizedItemId = typeof payload?.itemId === 'string' ? payload.itemId.trim() : '';
  const sourceBucketKey = normalizeToolbarConfiguratorProfileName(payload?.bucketKey || '');
  const targetBucketKey = normalizeToolbarConfiguratorProfileName(bucketKey);
  if (!normalizedItemId || sourceBucketKey === targetBucketKey) {
    return null;
  }

  const minimalIds = Array.isArray(normalizedState?.toolbarProfiles?.minimal)
    ? [...normalizedState.toolbarProfiles.minimal]
    : [];
  const masterIds = Array.isArray(normalizedState?.toolbarProfiles?.master)
    ? [...normalizedState.toolbarProfiles.master]
    : [];

  if (!masterIds.includes(normalizedItemId)) {
    return null;
  }

  if (sourceBucketKey === 'master' && targetBucketKey === 'minimal') {
    const nextMinimalIds = insertToolbarConfiguratorItemIntoBucket(minimalIds, normalizedItemId, insertionIndex);
    if (!nextMinimalIds) return null;
    return {
      ...normalizedState,
      toolbarProfiles: {
        ...normalizedState.toolbarProfiles,
        minimal: nextMinimalIds,
        master: masterIds,
      },
    };
  }

  if (sourceBucketKey === 'minimal' && targetBucketKey === 'master') {
    if (!minimalIds.includes(normalizedItemId)) {
      return null;
    }
    const nextMinimalIds = minimalIds.filter((currentItemId) => currentItemId !== normalizedItemId);
    if (nextMinimalIds.length === minimalIds.length) {
      return null;
    }
    return {
      ...normalizedState,
      toolbarProfiles: {
        ...normalizedState.toolbarProfiles,
        minimal: nextMinimalIds,
        master: masterIds,
      },
    };
  }

  return null;
}

function clearToolbarConfiguratorDragSource() {
  if (activeConfiguratorDragElement instanceof HTMLElement) {
    activeConfiguratorDragElement.classList.remove('is-dragging');
  }
  activeConfiguratorDragElement = null;
}

function clearToolbarConfiguratorDropTargets() {
  configuratorBuckets.forEach((bucket) => {
    bucket.classList.remove('is-drop-target', 'is-drop-target-inside');
    delete bucket.dataset.dropIndex;
    delete bucket.dataset.dropIntent;
    bucket.querySelectorAll('.configurator-panel__bucket-item.is-drop-target-before, .configurator-panel__bucket-item.is-drop-target-after').forEach((item) => {
      item.classList.remove('is-drop-target-before', 'is-drop-target-after');
    });
  });
}

function setToolbarConfiguratorDropTarget(bucket, marker = 'inside', hoveredItem = null) {
  clearToolbarConfiguratorDropTargets();
  if (!(bucket instanceof HTMLElement)) return;
  bucket.classList.add('is-drop-target');
  if (marker === 'inside') {
    bucket.classList.add('is-drop-target-inside');
    return;
  }
  if (hoveredItem instanceof HTMLElement) {
    hoveredItem.classList.add(marker === 'before' ? 'is-drop-target-before' : 'is-drop-target-after');
  }
}

function getToolbarConfiguratorBucketInsertionIndex(bucket, event, hoveredItem = null) {
  const bucketItems = getToolbarConfiguratorBucketItems(bucket);
  if (!bucketItems.length) return 0;

  const hoveredItemElement = hoveredItem instanceof HTMLElement
    ? hoveredItem
    : (event.target instanceof Element
      ? event.target.closest('.configurator-panel__bucket-item[data-item-id]')
      : null);

  if (hoveredItemElement instanceof HTMLElement && bucket.contains(hoveredItemElement)) {
    const hoveredIndex = Math.max(0, Number.parseInt(hoveredItemElement.dataset.bucketIndex || '0', 10) || 0);
    const hoveredRect = hoveredItemElement.getBoundingClientRect();
    const isBefore = event.clientX < (hoveredRect.left + hoveredRect.width / 2);
    const sourceIndex = Number.parseInt(activeConfiguratorDragPayload?.sourceIndex || '-1', 10);

    if (activeConfiguratorDragPayload?.sourceType === 'bucket-item'
      && activeConfiguratorDragPayload.itemId
      && activeConfiguratorDragPayload.itemId === hoveredItemElement.dataset.itemId) {
      return hoveredIndex;
    }

    if (Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < hoveredIndex) {
      return isBefore ? hoveredIndex - 1 : hoveredIndex;
    }

    return isBefore ? hoveredIndex : hoveredIndex + 1;
  }

  return bucketItems.length;
}

function commitToolbarConfiguratorBucketDrop(payload, bucketKey, insertionIndex, hoveredItem = null) {
  const targetBucketKey = normalizeToolbarConfiguratorProfileName(bucketKey);
  const normalizedItemId = typeof payload?.itemId === 'string' ? payload.itemId.trim() : '';
  if (!normalizedItemId) return false;

  const catalogItem = getToolbarConfiguratorCatalogItem(normalizedItemId);
  if (!catalogItem || catalogItem.implementationState !== 'live') return false;

  const dropIntent = getToolbarConfiguratorBucketDropIntent(payload, targetBucketKey);
  if (!dropIntent) return false;

  const currentIds = getToolbarConfiguratorProfileIds(targetBucketKey);
  const nextIds = [...currentIds];
  const clampedIndex = Math.min(Math.max(Number.isFinite(insertionIndex) ? insertionIndex : nextIds.length, 0), nextIds.length);

  if (payload?.sourceType === 'bucket-item') {
    if (dropIntent === 'return-to-master') {
      const nextState = resolveToolbarConfiguratorInterBucketTransfer(
        configuratorBucketState,
        payload,
        targetBucketKey,
        clampedIndex,
      );
      if (!nextState) return false;
      commitToolbarConfiguratorState(nextState);
      return true;
    }

    if (dropIntent === 'copy-from-master') {
      const nextState = resolveToolbarConfiguratorInterBucketTransfer(
        configuratorBucketState,
        payload,
        targetBucketKey,
        clampedIndex,
      );
      if (!nextState) return false;
      commitToolbarConfiguratorState(nextState);
      return true;
    } else {
      if (hoveredItem instanceof HTMLElement && hoveredItem.dataset.itemId === normalizedItemId) return false;
      const reorderedIds = moveToolbarConfiguratorItemWithinBucket(nextIds, normalizedItemId, clampedIndex);
      if (!reorderedIds) return false;
      commitToolbarConfiguratorState({
        ...configuratorBucketState,
        toolbarProfiles: {
          ...configuratorBucketState.toolbarProfiles,
          [targetBucketKey]: reorderedIds,
        },
      });
      return true;
    }
  } else {
    if (nextIds.includes(normalizedItemId)) return false;
    nextIds.splice(clampedIndex, 0, normalizedItemId);
  }

  if (nextIds.join('\u0000') === currentIds.join('\u0000')) {
    return false;
  }

  commitToolbarConfiguratorState({
    ...configuratorBucketState,
    toolbarProfiles: {
      ...configuratorBucketState.toolbarProfiles,
      [targetBucketKey]: nextIds,
    },
  });
  return true;
}

function renderToolbarConfiguratorProfileSwitch() {
  const activeProfile = getToolbarConfiguratorActiveProfile();
  configuratorProfileSwitchButtons.forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    const profileName = normalizeToolbarConfiguratorProfileName(button.dataset.toolbarProfileSwitch || '');
    const isActive = profileName === activeProfile;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-checked', isActive ? 'true' : 'false');
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.tabIndex = isActive ? 0 : -1;
  });
}

function commitToolbarConfiguratorState(nextState) {
  const normalizedState = createToolbarConfiguratorState(nextState);
  configuratorBucketState = normalizedState;
  reconcileToolbarConfiguratorBucketItemSelection();
  if (normalizeProjectId(currentProjectId)) {
    writeToolbarConfiguratorStoredState(currentProjectId, normalizedState);
  }
  renderToolbarConfiguratorLibrary();
  renderToolbarConfiguratorProfileSwitch();
  renderToolbarConfiguratorBuckets();
  projectMainFloatingToolbarRuntime('configurator-commit');
  return normalizedState;
}

function adoptToolbarConfiguratorState(projectId = currentProjectId) {
  const resolution = resolveToolbarConfiguratorState(projectId);
  if (resolution.shouldConsumeLegacySource) {
    consumeLegacyConfiguratorBuckets(localStorage);
  }
  if (resolution.shouldPersist) {
    writeToolbarConfiguratorStoredState(projectId, resolution.state);
  }
  configuratorBucketState = resolution.state;
  reconcileToolbarConfiguratorBucketItemSelection();
  renderToolbarConfiguratorLibrary();
  renderToolbarConfiguratorProfileSwitch();
  renderToolbarConfiguratorBuckets();
  projectMainFloatingToolbarRuntime('configurator-adopt');
  return resolution;
}

function createToolbarConfiguratorLibraryButton(entry) {
  const isPlaceholder = entry?.kind === 'placeholder';
  const catalogEntry = isPlaceholder ? null : entry?.entry || entry || null;
  const isLiveEntry = !isPlaceholder && catalogEntry?.implementationState === 'live';
  const isSelected = isLiveEntry && getToolbarConfiguratorProfileIds(getToolbarConfiguratorActiveProfile()).includes(catalogEntry.id);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `configurator-panel__slot${isPlaceholder ? ' configurator-panel__slot--placeholder' : ''}`;
  button.draggable = isLiveEntry;
  button.disabled = !isLiveEntry;
  if (isLiveEntry) {
    button.dataset.itemId = catalogEntry.id;
  } else {
    button.dataset.slotPlaceholder = 'true';
  }
  button.dataset.implementationState = catalogEntry?.implementationState || '';
  button.setAttribute('aria-label', isPlaceholder ? TOOLBAR_CONFIGURATOR_LIBRARY_PLACEHOLDER_TEXT : getToolbarConfiguratorEntryAriaLabel(catalogEntry));
  button.setAttribute('aria-disabled', isLiveEntry ? 'false' : 'true');
  if (isSelected) {
    button.classList.add('is-selected');
    button.setAttribute('aria-pressed', 'true');
  }

  const icon = document.createElement('span');
  icon.className = 'configurator-panel__slot-icon';
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'configurator-panel__slot-text';
  text.textContent = isPlaceholder
    ? (entry?.label || TOOLBAR_CONFIGURATOR_LIBRARY_PLACEHOLDER_TEXT)
    : getToolbarConfiguratorEntryPanelLabel(catalogEntry);

  button.append(icon, text);
  return button;
}

function renderToolbarConfiguratorLibrary() {
  if (!configuratorLibraryGrid) return;
  configuratorLibraryGrid.replaceChildren();

  getToolbarConfiguratorLibraryColumns().forEach((groupItems) => {
    const column = document.createElement('div');
    column.className = 'configurator-panel__column';

    groupItems.forEach((entry) => {
      column.appendChild(createToolbarConfiguratorLibraryButton(entry));
    });
    configuratorLibraryGrid.appendChild(column);
  });
}

function createToolbarConfiguratorBucketItem(itemId, bucketKey, index) {
  const entry = getToolbarConfiguratorCatalogItem(itemId);
  const label = getToolbarConfiguratorEntryPanelLabel(entry) || itemId;
  const isActiveItem = isToolbarConfiguratorBucketItemSelected(bucketKey, itemId);

  const item = document.createElement('div');
  item.className = `configurator-panel__bucket-item${isActiveItem ? ' is-active' : ''}`;
  item.draggable = true;
  item.dataset.bucketKey = bucketKey;
  item.dataset.bucketIndex = String(index);
  item.dataset.itemId = itemId;
  item.setAttribute('role', 'listitem');
  item.setAttribute('aria-label', label);
  item.tabIndex = 0;

  const icon = document.createElement('span');
  icon.className = 'configurator-panel__slot-icon';
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'configurator-panel__slot-text';
  text.textContent = label;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'configurator-panel__bucket-remove';
  removeButton.dataset.configuratorRemove = 'true';
  removeButton.dataset.itemId = itemId;
  removeButton.dataset.bucketKey = bucketKey;
  removeButton.setAttribute('aria-label', `Remove ${label}`);
  removeButton.textContent = '×';

  item.append(icon, text, removeButton);
  return item;
}

function syncToolbarConfiguratorSectionVisibility() {
  if (configuratorMasterSection instanceof HTMLElement) {
    configuratorMasterSection.hidden = getToolbarConfiguratorActiveProfile() !== 'master';
  }
  if (configuratorMinimalSection instanceof HTMLElement) {
    configuratorMinimalSection.hidden = getToolbarConfiguratorActiveProfile() === 'master';
  }
}

function renderToolbarConfiguratorBuckets() {
  syncToolbarConfiguratorSectionVisibility();
  configuratorBuckets.forEach((bucket) => {
    const bucketKey = bucket.dataset.configuratorBucket || '';
    bucket.replaceChildren();
    bucket.hidden = false;
    if (!TOOLBAR_CONFIGURATOR_PROFILE_NAMES.includes(bucketKey)) {
      return;
    }
    getToolbarConfiguratorProfileIds(bucketKey).forEach((itemId, index) => {
      bucket.appendChild(createToolbarConfiguratorBucketItem(itemId, bucketKey, index));
    });
  });
}

function addToolbarConfiguratorItem(itemId, bucketKey = getToolbarConfiguratorActiveProfile()) {
  const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
  if (!normalizedItemId) return;
  const catalogItem = getToolbarConfiguratorCatalogItem(normalizedItemId);
  if (!catalogItem || catalogItem.implementationState !== 'live') return;
  const targetBucketKey = normalizeToolbarConfiguratorProfileName(bucketKey);
  const targetIds = getToolbarConfiguratorProfileIds(targetBucketKey);
  if (targetIds.includes(normalizedItemId)) return;
  commitToolbarConfiguratorState({
    ...configuratorBucketState,
    toolbarProfiles: {
      ...configuratorBucketState.toolbarProfiles,
      [targetBucketKey]: [...targetIds, normalizedItemId],
    },
  });
}

function removeToolbarConfiguratorItem(itemId, bucketKey = getToolbarConfiguratorActiveProfile()) {
  const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
  if (!normalizedItemId) return;
  const targetBucketKey = normalizeToolbarConfiguratorProfileName(bucketKey);
  const targetIds = getToolbarConfiguratorProfileIds(targetBucketKey);
  const nextIds = targetIds.filter((currentItemId) => currentItemId !== normalizedItemId);
  if (nextIds.length === targetIds.length) return;
  commitToolbarConfiguratorState({
    ...configuratorBucketState,
    toolbarProfiles: {
      ...configuratorBucketState.toolbarProfiles,
      [targetBucketKey]: nextIds,
    },
  });
}

function setToolbarConfiguratorActiveProfile(profileName) {
  const nextProfile = normalizeToolbarConfiguratorProfileName(profileName);
  if (nextProfile === getToolbarConfiguratorActiveProfile()) {
    return false;
  }
  clearToolbarConfiguratorBucketItemSelection(false);
  commitToolbarConfiguratorState({
    ...configuratorBucketState,
    activeToolbarProfile: nextProfile,
  });
  return true;
}

function initializeToolbarConfiguratorFoundation() {
  if (!configuratorPanel || !configuratorLibraryGrid || !configuratorBuckets.length) {
    return;
  }

  adoptToolbarConfiguratorState(currentProjectId);

  configuratorPanel.addEventListener('click', (event) => {
    if (event.target === configuratorPanel) {
      setConfiguratorOpen(false);
      return;
    }

    const profileSwitchButton = event.target instanceof Element
      ? event.target.closest('[data-toolbar-profile-switch]')
      : null;
    if (profileSwitchButton instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      setToolbarConfiguratorActiveProfile(profileSwitchButton.dataset.toolbarProfileSwitch || '');
      return;
    }

    const removeButton = event.target instanceof Element
      ? event.target.closest('[data-configurator-remove]')
      : null;
    if (removeButton instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      const bucketKey = removeButton.dataset.bucketKey
        || removeButton.closest('[data-configurator-bucket]')?.dataset.configuratorBucket
        || getToolbarConfiguratorActiveProfile();
      removeToolbarConfiguratorItem(removeButton.dataset.itemId || '', bucketKey);
      return;
    }

    const bucketItem = event.target instanceof Element
      ? event.target.closest('.configurator-panel__bucket-item[data-item-id]')
      : null;
    if (
      bucketItem instanceof HTMLElement
      && configuratorBuckets.some((bucket) => bucket.contains(bucketItem))
    ) {
      event.preventDefault();
      event.stopPropagation();
      setToolbarConfiguratorBucketItemSelection(
        bucketItem.dataset.bucketKey || '',
        bucketItem.dataset.itemId || '',
      );
      return;
    }

    const libraryButton = event.target instanceof Element
      ? event.target.closest('.configurator-panel__slot[data-item-id]')
      : null;
    if (libraryButton instanceof HTMLElement && configuratorLibraryGrid.contains(libraryButton)) {
      event.preventDefault();
      event.stopPropagation();
      addToolbarConfiguratorItem(libraryButton.dataset.itemId || '', getToolbarConfiguratorActiveProfile());
    }
  });

  configuratorPanel.addEventListener('focusin', (event) => {
    const bucketItem = event.target instanceof Element
      ? event.target.closest('.configurator-panel__bucket-item[data-item-id]')
      : null;
    if (
      bucketItem instanceof HTMLElement
      && configuratorBuckets.some((bucket) => bucket.contains(bucketItem))
    ) {
      setToolbarConfiguratorBucketItemSelection(
        bucketItem.dataset.bucketKey || '',
        bucketItem.dataset.itemId || '',
      );
    }
  });

  configuratorPanel.addEventListener('dragstart', (event) => {
    const sourceElement = event.target instanceof Element
      ? event.target.closest('.configurator-panel__slot[data-item-id], .configurator-panel__bucket-item[data-item-id]')
      : null;
    if (!(sourceElement instanceof HTMLElement)) {
      return;
    }
    const isLibraryButton = configuratorLibraryGrid.contains(sourceElement);
    const isBucketItem = !isLibraryButton && sourceElement.matches('.configurator-panel__bucket-item[data-item-id]');
    if (!isLibraryButton && !isBucketItem) {
      return;
    }
    const sourceBucketKey = isBucketItem
      ? normalizeToolbarConfiguratorProfileName(
        sourceElement.dataset.bucketKey || sourceElement.closest('[data-configurator-bucket]')?.dataset.configuratorBucket || ''
      )
      : '';
    const itemId = sourceElement.dataset.itemId || '';
    if (!itemId || !event.dataTransfer) return;
    activeConfiguratorDragPayload = {
      sourceType: isBucketItem ? 'bucket-item' : 'library-item',
      itemId,
      bucketKey: isBucketItem
        ? sourceBucketKey
        : undefined,
      sourceIndex: isBucketItem ? sourceElement.dataset.bucketIndex || '' : undefined,
    };
    activeConfiguratorDragElement = sourceElement;
    writeConfiguratorDragPayload(event, activeConfiguratorDragPayload);
    sourceElement.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = isBucketItem ? 'move' : 'copy';
  });

  configuratorPanel.addEventListener('dragend', () => {
    clearToolbarConfiguratorDragSource();
    activeConfiguratorDragPayload = null;
    clearToolbarConfiguratorDropTargets();
  });

  configuratorBuckets.forEach((bucket) => {
    const bucketKey = bucket.dataset.configuratorBucket || '';
    bucket.addEventListener('dragover', (event) => {
      const payload = readConfiguratorDragPayload(event);
      const dropIntent = getToolbarConfiguratorBucketDropIntent(payload, bucketKey);
      if (!payload || !payload.sourceType || !payload.itemId || !dropIntent) return;
      const hoveredItem = event.target instanceof Element
        ? event.target.closest('.configurator-panel__bucket-item[data-item-id]')
        : null;
      const insertionIndex = dropIntent === 'return-to-master'
        ? getToolbarConfiguratorProfileIds('master').length
        : getToolbarConfiguratorBucketInsertionIndex(bucket, event, hoveredItem);
      const marker = dropIntent === 'return-to-master'
        ? 'inside'
        : hoveredItem instanceof HTMLElement && bucket.contains(hoveredItem)
          ? (event.clientX < hoveredItem.getBoundingClientRect().left + hoveredItem.getBoundingClientRect().width / 2 ? 'before' : 'after')
          : 'inside';
      setToolbarConfiguratorDropTarget(bucket, marker, hoveredItem instanceof HTMLElement && bucket.contains(hoveredItem) ? hoveredItem : null);
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = payload.sourceType === 'bucket-item' ? 'move' : 'copy';
      }
      bucket.dataset.dropIndex = String(insertionIndex);
      bucket.dataset.dropIntent = dropIntent;
    });
    bucket.addEventListener('dragleave', () => {
      clearToolbarConfiguratorDropTargets();
    });
    bucket.addEventListener('drop', (event) => {
      const payload = readConfiguratorDragPayload(event);
      const dropIntent = getToolbarConfiguratorBucketDropIntent(payload, bucketKey);
      const hoveredItem = event.target instanceof Element
        ? event.target.closest('.configurator-panel__bucket-item[data-item-id]')
        : null;
      const insertionIndex = dropIntent === 'return-to-master'
        ? getToolbarConfiguratorProfileIds('master').length
        : getToolbarConfiguratorBucketInsertionIndex(bucket, event, hoveredItem);
      event.preventDefault();
      clearToolbarConfiguratorDropTargets();
      delete bucket.dataset.dropIndex;
      delete bucket.dataset.dropIntent;
      if (!payload || !payload.sourceType || !payload.itemId || !dropIntent) {
        activeConfiguratorDragPayload = null;
        return;
      }
      commitToolbarConfiguratorBucketDrop(payload, bucketKey, insertionIndex, hoveredItem instanceof HTMLElement ? hoveredItem : null);
      activeConfiguratorDragPayload = null;
    });
  });
}

function updateTransformingClass() {
  if (!toolbarShell) return;
  toolbarShell.classList.toggle('is-transforming', Boolean(floatingToolbarInteractionState.mode));
}

function setFloatingToolbarHandlesVisible(nextVisible) {
  if (!toolbarShell) return;
  floatingToolbarHandlesVisible = Boolean(nextVisible);
  toolbarShell.classList.toggle('is-handles-visible', floatingToolbarHandlesVisible);
}

function startFloatingToolbarInteraction(mode, event) {
  if (!toolbarShell) return;
  if (mode === 'move' && !canStartFloatingToolbarDrag(event.target)) {
    return;
  }
  event.preventDefault();
  const origin = { ...floatingToolbarState };
  floatingToolbarInteractionState = {
    mode,
    active: false,
    startX: event.clientX,
    startY: event.clientY,
    origin,
  };
  updateTransformingClass();
}

function stopFloatingToolbarInteraction() {
  if (!toolbarShell) return;
  if (floatingToolbarInteractionState.mode) {
    persistFloatingToolbarState();
  }
  floatingToolbarInteractionState = {
    mode: null,
    active: false,
    startX: 0,
    startY: 0,
    origin: null,
  };
  toolbarShell.classList.remove('is-dragging');
  updateTransformingClass();
}

function initializeFloatingToolbarItemOffsetTuning() {
  if (!toolbarTunableItems.length) return;
  restoreFloatingToolbarItemOffsets();
  toolbarTunableItems.forEach((item) => {
    item.addEventListener('mousedown', (event) => {
      const tuningIntent = toolbarSpacingTuningMode || event.altKey;
      if (event.button !== 0 || !tuningIntent) return;
      const key = getFloatingToolbarItemOffsetKey(item);
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      toolbarItemOffsetDragState = {
        active: true,
        item,
        key,
        startX: event.clientX,
        originOffset: Number(toolbarItemOffsets[key] || 0),
        moved: false,
      };
    });
    item.addEventListener('dblclick', (event) => {
      if (!toolbarSpacingTuningMode && !event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      setFloatingToolbarItemOffset(item, 0);
      floatingToolbarSuppressClickOnce = true;
    });
    item.addEventListener('click', (event) => {
      if (!toolbarItemSuppressClickOnce && !event.altKey && !toolbarSpacingTuningMode) return;
      event.preventDefault();
      event.stopPropagation();
      toolbarItemSuppressClickOnce = false;
    });
  });

  document.addEventListener('mousemove', (event) => {
    if (!toolbarItemOffsetDragState.active || !toolbarItemOffsetDragState.item) return;
    const deltaX = event.clientX - toolbarItemOffsetDragState.startX;
    if (!toolbarItemOffsetDragState.moved && Math.abs(deltaX) >= 1) {
      toolbarItemOffsetDragState.moved = true;
      floatingToolbarSuppressClickOnce = true;
      toolbarItemSuppressClickOnce = true;
    }
    setFloatingToolbarItemOffset(
      toolbarItemOffsetDragState.item,
      toolbarItemOffsetDragState.originOffset + deltaX,
      false
    );
    event.preventDefault();
  });

  document.addEventListener('mouseup', () => {
    stopFloatingToolbarItemOffsetDrag();
  });
}

function initializeFloatingToolbarSpacingMenu() {
  if (!toolbarShell || !toolbarSpacingMenu || !toolbarSpacingAction) return;
  setToolbarSpacingTuningMode(false);
  toolbarShell.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-toolbar-rotate-handle], [data-toolbar-width-handle], [data-toolbar-scale-handle]')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setToolbarSpacingMenuOpen(true);
    toolbarSpacingAction.focus();
  });
  toolbarSpacingAction.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setToolbarSpacingTuningMode(!toolbarSpacingTuningMode);
    setToolbarSpacingMenuOpen(false);
  });
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!toolbarSpacingMenu.contains(target)) {
      setToolbarSpacingMenuOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setToolbarSpacingMenuOpen(false);
      if (toolbarSpacingTuningMode) {
        setToolbarSpacingTuningMode(false);
      }
    }
  });
}

function initializeFloatingToolbarParagraphMenu() {
  if (!toolbarShell || !paragraphMenu || !paragraphTriggerButton) return;
  paragraphMenu.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-paragraph-alignment]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const action = target.dataset.paragraphAlignment;
    if (action) {
      handleUiAction(action);
    }
    setParagraphMenuOpen(false);
  });
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!paragraphMenu.contains(target) && target !== paragraphTriggerButton && !paragraphTriggerButton.contains(target)) {
      setParagraphMenuOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setParagraphMenuOpen(false);
    }
  });
}

function initializeFloatingToolbarListMenu() {
  if (!toolbarShell || !listMenu || !listTriggerButton) return;
  listMenu.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-list-action]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const action = target.dataset.listAction || '';
    void dispatchListTypeAction(action).then(() => {
      syncToolbarFormattingState();
    });
    setListMenuOpen(false);
  });
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!listMenu.contains(target) && target !== listTriggerButton && !listTriggerButton.contains(target)) {
      setListMenuOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setListMenuOpen(false);
    }
  });
}

function initializeFloatingToolbarColorPickerOverlay() {
  if (!toolbarShell || !toolbarColorPickerOverlay) return;

  toolbarColorPickerOverlay.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-toolbar-color-swatch-value], [data-toolbar-color-picker-close]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    if (target.hasAttribute('data-toolbar-color-picker-close')) {
      setToolbarColorPickerOpen(false);
      return;
    }
    const swatchValue = target.dataset.toolbarColorSwatchValue || '';
    setToolbarColorPickerSelection(swatchValue);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (toolbarColorPickerOverlay.hidden) return;
    if (toolbarColorPickerOverlay.contains(target)) return;
    if (target.closest('[data-toolbar-item-key="color-text"], [data-toolbar-item-key="color-highlight"]')) return;
    setToolbarColorPickerOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !toolbarColorPickerOverlay.hidden) {
      event.preventDefault();
      setToolbarColorPickerOpen(false);
    }
  });
}

function initializeFloatingToolbarStylesMenu() {
  if (!toolbarShell || !toolbarStylesMenu) return;

  toolbarStylesMenu.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-style-paragraph-option], [data-style-character-option]')
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const optionId = target.getAttribute('data-style-paragraph-option')
      || target.getAttribute('data-style-character-option')
      || '';
    if (!optionId) return;
    applyTextStyle(optionId);
    setToolbarStylesMenuOpen(false);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (toolbarStylesMenu.hidden) return;
    if (toolbarStylesMenu.contains(target)) return;
    if (target.closest('[data-toolbar-item-key="style-paragraph"], [data-toolbar-item-key="style-character"]')) return;
    setToolbarStylesMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !toolbarStylesMenu.hidden) {
      event.preventDefault();
      setToolbarStylesMenuOpen(false);
    }
  });
}

function isMainToolbarInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        '.floating-toolbar__button',
        '.floating-toolbar__select-wrap',
        '.floating-toolbar__display',
        '.floating-toolbar__paragraph-menu-item',
        '.floating-toolbar__list-menu-item',
        '.floating-toolbar__styles-menu-item',
        '.floating-toolbar__color-picker-close',
        '[data-toolbar-color-swatch-value]',
        '.floating-toolbar-spacing-menu__action',
        '.floating-toolbar__select',
      ].join(', ')
    )
  );
}

function isMainToolbarSelectionPreservingTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        '.floating-toolbar__button',
        '.floating-toolbar__paragraph-menu-item',
        '.floating-toolbar__list-menu-item',
        '.floating-toolbar__styles-menu-item',
        '.floating-toolbar__color-picker-close',
        '[data-toolbar-color-swatch-value]',
        '.floating-toolbar-spacing-menu__action',
      ].join(', ')
    )
  );
}

function initializeFloatingToolbarDragFoundation() {
  if (!toolbarShell) return;
  const preserveSelectionOnMouseDown = (event) => {
    if (event.button !== 0) return;
    if (!isMainToolbarSelectionPreservingTarget(event.target)) return;
    event.preventDefault();
  };
  [
    toolbarShell,
    paragraphMenu,
    listMenu,
    toolbarStylesMenu,
    toolbarColorPickerOverlay,
    toolbarSpacingMenu,
  ].forEach((surface) => {
    surface?.addEventListener('mousedown', preserveSelectionOnMouseDown, true);
  });
  toolbarShell.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    if (isMainToolbarInteractiveTarget(event.target)) return;
    startFloatingToolbarInteraction('move', event);
  });
  toolbarRotateHandles.forEach((handle) => {
    handle.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    handle.addEventListener('click', (event) => {
      event.stopPropagation();
      applyFloatingToolbarState({
        ...floatingToolbarState,
        isVertical: !floatingToolbarState.isVertical,
      });
    });
  });
  toolbarWidthHandle?.addEventListener('mousedown', (event) => {
    event.stopPropagation();
    startFloatingToolbarInteraction('width', event);
  });
  toolbarScaleHandle?.addEventListener('mousedown', (event) => {
    event.stopPropagation();
    startFloatingToolbarInteraction('scale', event);
  });
  document.addEventListener('mousemove', (event) => {
    const { mode, origin } = floatingToolbarInteractionState;
    if (!mode || !origin) return;
    const deltaX = event.clientX - floatingToolbarInteractionState.startX;
    const deltaY = event.clientY - floatingToolbarInteractionState.startY;
    if (mode === 'move') {
      if (!floatingToolbarInteractionState.active) {
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < FLOATING_TOOLBAR_DRAG_THRESHOLD_PX) {
          return;
        }
        floatingToolbarInteractionState.active = true;
        floatingToolbarSuppressClickOnce = true;
        toolbarShell.classList.add('is-dragging');
      }
      const topBarRect = topWorkBar?.getBoundingClientRect();
      const pointerNearSnapZone = Boolean(
        topBarRect &&
        event.clientY >= topBarRect.top - FLOATING_TOOLBAR_SNAP_ZONE_PX &&
        event.clientY <= topBarRect.bottom + FLOATING_TOOLBAR_SNAP_ZONE_PX
      );
      if (pointerNearSnapZone) {
        const shellRect = toolbarShell.getBoundingClientRect();
        const snapped = getSnappedFloatingToolbarPosition(shellRect);
        applyFloatingToolbarState({
          ...origin,
          x: getSnappedFloatingToolbarX(origin.x + deltaX, shellRect),
          y: snapped.y,
          isDetached: false,
          toolbarHeight: topBarRect?.height || origin.toolbarHeight || 0,
        }, false);
      } else {
        applyFloatingToolbarState({
          ...origin,
          x: origin.x + deltaX,
          y: origin.y + deltaY,
          isDetached: true,
          toolbarHeight: topBarRect?.height || origin.toolbarHeight || 0,
        }, false);
      }
    } else if (mode === 'width') {
      floatingToolbarInteractionState.active = true;
      const widthDelta = (origin.isVertical ? deltaX : deltaX) * 0.01;
      const nextWidthScale = origin.widthScale + widthDelta;
      applyFloatingToolbarState({
        ...origin,
        widthScale: nextWidthScale,
        dockedWidthScale: origin.isDetached ? origin.dockedWidthScale : nextWidthScale,
        freeWidthScale: origin.isDetached ? nextWidthScale : origin.freeWidthScale,
      }, false);
    } else if (mode === 'scale') {
      floatingToolbarInteractionState.active = true;
      const scaleDelta = (origin.isVertical ? deltaX : deltaX) * 0.01;
      applyFloatingToolbarState({
        ...origin,
        scale: origin.scale + scaleDelta,
      }, false);
    }
    event.preventDefault();
  });

  document.addEventListener('mouseup', () => {
    if (!floatingToolbarInteractionState.mode) return;
    stopFloatingToolbarInteraction();
  });

  toolbarShell.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (floatingToolbarSuppressClickOnce) {
      floatingToolbarSuppressClickOnce = false;
      return;
    }
    if (target.closest('button, select, option, input, textarea, label, [data-toolbar-rotate-handle], [data-toolbar-width-handle], [data-toolbar-scale-handle]')) {
      return;
    }
    setFloatingToolbarHandlesVisible(!floatingToolbarHandlesVisible);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!toolbarShell.contains(target)) {
      setFloatingToolbarHandlesVisible(false);
    }
  });

  window.addEventListener('resize', () => {
    restoreFloatingToolbarPosition();
    scheduleToolbarAnchorUpdate();
  });

  requestAnimationFrame(() => {
    restoreFloatingToolbarPosition();
    scheduleToolbarAnchorUpdate();
  });
}

const commandRegistry = createCommandRegistry();
const runCommand = createCommandRunner(commandRegistry, {
  capability: {
    defaultPlatformId: window.electronAPI ? 'node' : 'web',
  },
});
registerProjectCommands(commandRegistry, {
  electronAPI: window.electronAPI,
  uiActions: {
    openSettings: () => openSettingsModal(),
    safeResetShell: () => performSafeResetShell(),
    restoreLastStableShell: () => performRestoreLastStableShell(),
    openDiagnostics: () => openDiagnosticsModal(),
    openRecovery: () => openRecoveryModal('Recovery modal opened from menu'),
    switchMode: (mode) => applyMode(mode),
    undo: () => handleUndo(),
    redo: () => handleRedo(),
    find: () => handleFind(),
    replace: () => handleReplace(),
    zoomOut: () => handleZoomOut(),
    zoomIn: () => handleZoomIn(),
    toggleWrap: () => handleToggleWrap(),
    togglePreview: () => handleToggleLayoutPreview(),
    togglePreviewFrame: () => handleToggleLayoutPreviewFrame(),
    insertMarkdownPrompt: () => handleInsertMarkdownPrompt(),
    insertFlowOpen: () => handleInsertFlowOpen(),
    insertAddCard: () => handleInsertAddCard(),
    formatToggleBold: () => handleTiptapFormatCommand('toggleBold'),
    formatToggleItalic: () => handleTiptapFormatCommand('toggleItalic'),
    formatToggleUnderline: () => handleTiptapFormatCommand('toggleUnderline'),
    formatTextColorPicker: () => handleFormatTextColorPicker(),
    formatHighlightColorPicker: () => handleFormatHighlightColorPicker(),
    formatAlignLeft: () => handleFormatAlign('align-left'),
    formatAlignCenter: () => handleFormatAlign('align-center'),
    formatAlignRight: () => handleFormatAlign('align-right'),
    formatAlignJustify: () => handleFormatAlign('align-justify'),
    listToggleBullet: () => handleTiptapFormatCommand('toggleBulletList'),
    listToggleOrdered: () => handleTiptapFormatCommand('toggleOrderedList'),
    listClear: () => handleTiptapFormatCommand('clearList'),
    insertLinkPrompt: (payload = {}) => handleInsertLinkPrompt(payload),
    reviewOpenComments: () => handleReviewOpenComments(),
    planFlowSave: () => handlePlanFlowSave(),
    reviewExportMarkdown: () => handleReviewExportMarkdown(),
  },
});
const PREVIEW_FORMAT_COMMAND_IDS = Object.freeze({
  A4: 'cmd.project.view.previewFormatA4',
  A5: 'cmd.project.view.previewFormatA5',
  LETTER: 'cmd.project.view.previewFormatLetter',
});

[
  { id: PREVIEW_FORMAT_COMMAND_IDS.A4, label: 'Preview Format A4', formatId: 'A4' },
  { id: PREVIEW_FORMAT_COMMAND_IDS.A5, label: 'Preview Format A5', formatId: 'A5' },
  { id: PREVIEW_FORMAT_COMMAND_IDS.LETTER, label: 'Preview Format Letter', formatId: 'LETTER' },
].forEach(({ id, label, formatId }) => {
  commandRegistry.registerCommand(
    {
      id,
      label,
      group: 'view',
      surface: ['palette'],
      hotkey: '',
    },
    async () => {
      setActiveBookProfileFormat(formatId);
      return { formatId };
    },
  );
});
const commandPaletteDataProvider = createPaletteDataProvider(commandRegistry, { defaultSurface: 'palette' });
window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ = commandPaletteDataProvider;
const MARKDOWN_IMPORT_STATUS_MESSAGE = 'Imported Markdown v1';
const MARKDOWN_EXPORT_STATUS_MESSAGE = 'Exported Markdown v1';
const MARKDOWN_IMPORT_PROMPT_TITLE = 'Import Markdown v1';
const MARKDOWN_EXPORT_PROMPT_COPY_HINT = 'Export Markdown v1 (copy text below)';
const LINK_PROMPT_TITLE = 'Insert link';
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

function withEditorModeCommandPayload(payload = {}) {
  const basePayload = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  return {
    ...basePayload,
    editorMode: isTiptapMode ? 'tiptap' : 'legacy',
  };
}

async function dispatchUiCommand(commandId, payload = {}) {
  const result = await runCommandThroughBus(runCommand, commandId, withEditorModeCommandPayload(payload), {
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
    scenes: scenes.map((scene) => ({
      path: scene.path,
      title: scene.title,
      kind: scene.kind,
      content: scene.content,
    })),
    dirty: false,
  };

  setPlainText(composeFlowDocument(scenes));
  updateWordCount();
  localDirty = false;
  if (window.electronAPI && typeof window.electronAPI.notifyDirtyState === 'function') {
    window.electronAPI.notifyDirtyState(false);
  }
  showEditorPanelFor('Flow mode');
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
  if (window.electronAPI && typeof window.electronAPI.notifyDirtyState === 'function') {
    window.electronAPI.notifyDirtyState(false);
  }
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
    scheduleLayoutPreviewRefresh();
    return;
  }
  const includePagination = options.includePagination !== false;
  const preserveSelection = options.preserveSelection !== false;
  if (options.deferRender === true) {
    scheduleDeferredHotpathRender({ includePagination, preserveSelection });
    scheduleLayoutPreviewRefresh();
    return;
  }
  cancelDeferredRenderWork();
  renderStyledView(text, { includePagination, preserveSelection });
  scheduleLayoutPreviewRefresh();
}

function parseDocumentContent(rawText = '') {
  return parseObservablePayload(rawText);
}

function composeDocumentContent() {
  const tiptapSnapshot = isTiptapMode ? getTiptapDocumentSnapshot() : null;
  return composeObservablePayload({
    doc: tiptapSnapshot ? tiptapSnapshot.doc : null,
    text: tiptapSnapshot ? tiptapSnapshot.text : getPlainText(),
    metaEnabled,
    meta: currentMeta,
    cards: currentCards,
  });
}

function composeEditorSnapshot() {
  return {
    content: composeDocumentContent(),
    plainText: getPlainText(),
    bookProfile: getActiveBookProfile(),
  };
}

function applyIncomingBookProfile(bookProfile) {
  const normalizedResult = normalizeBookProfile(bookProfile);
  activeBookProfileState = normalizedResult.ok ? normalizedResult.value : DEFAULT_ACTIVE_BOOK_PROFILE;
  const metrics = getPageMetrics({
    profile: activeBookProfileState,
    zoom: editorZoom,
  });
  if (metrics) {
    applyPageGeometryCssVars(metrics);
  }
  syncPreviewChromeFormatValue();
  scheduleLayoutPreviewRefresh();
}

function handleDocumentContentParseIssue(issue) {
  if (!issue || typeof issue !== 'object') {
    return;
  }
  updateWarningStateText('recovery');
  if (recoveryMessage) {
    recoveryMessage.textContent = issue.userMessage || 'Recovery ready';
  }
  if (typeof issue.userMessage === 'string' && issue.userMessage.length > 0) {
    updateStatusText(issue.userMessage);
  }
}

function getSelectionOffsets() {
  if (isTiptapMode) {
    return getTiptapSelectionOffsets();
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
  if (isTiptapMode) {
    setTiptapSelectionOffsets(start, end);
    return;
  }
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

function focusEditorSurface(position = 'current') {
  if (!editor) {
    return { performed: false, action: 'focusEditorSurface', reason: 'EDITOR_UNAVAILABLE', position };
  }

  if (isTiptapMode) {
    return focusTiptapSurface(position);
  }

  try {
    editor.focus({ preventScroll: true });
  } catch {
    editor.focus();
  }
  return { performed: true, action: 'focusEditorSurface', reason: null, position };
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

function getSpatialLayoutBaselineForViewport(viewportWidth = getSpatialLayoutViewportWidth()) {
  const mode = getSpatialLayoutMode(viewportWidth);
  if (mode === 'mobile') {
    return {
      version: SPATIAL_LAYOUT_VERSION,
      projectId: normalizeProjectId(currentProjectId),
      leftSidebarWidth: SPATIAL_LAYOUT_MOBILE_LEFT_BASELINE_WIDTH,
      rightSidebarWidth: SPATIAL_LAYOUT_MOBILE_RIGHT_BASELINE_WIDTH,
      viewportWidth,
      viewportMode: mode,
      savedAtUtc: '',
      source: 'baseline',
    };
  }
  if (mode === 'compact') {
    return {
      version: SPATIAL_LAYOUT_VERSION,
      projectId: normalizeProjectId(currentProjectId),
      leftSidebarWidth: SPATIAL_LAYOUT_COMPACT_LEFT_BASELINE_WIDTH,
      rightSidebarWidth: SPATIAL_LAYOUT_COMPACT_RIGHT_BASELINE_WIDTH,
      viewportWidth,
      viewportMode: mode,
      savedAtUtc: '',
      source: 'baseline',
    };
  }
  return {
    version: SPATIAL_LAYOUT_VERSION,
    projectId: normalizeProjectId(currentProjectId),
    leftSidebarWidth: SPATIAL_LAYOUT_DESKTOP_LEFT_BASELINE_WIDTH,
    rightSidebarWidth: SPATIAL_LAYOUT_DESKTOP_RIGHT_BASELINE_WIDTH,
    viewportWidth,
    viewportMode: mode,
    savedAtUtc: '',
    source: 'baseline',
  };
}

function getSpatialLayoutConstraintsForViewport(viewportWidth = getSpatialLayoutViewportWidth()) {
  const mode = getSpatialLayoutMode(viewportWidth);
  if (mode === 'mobile') {
    return {
      mode,
      leftMin: SPATIAL_LAYOUT_LEFT_MIN_WIDTH,
      leftMax: SPATIAL_LAYOUT_MOBILE_LEFT_BASELINE_WIDTH,
      rightMin: SPATIAL_LAYOUT_LEFT_MIN_WIDTH,
      rightMax: SPATIAL_LAYOUT_MOBILE_RIGHT_BASELINE_WIDTH,
      rightVisible: false,
    };
  }
  if (mode === 'compact') {
    return {
      mode,
      leftMin: 250,
      leftMax: 320,
      rightMin: 250,
      rightMax: 320,
      rightVisible: true,
    };
  }
  return {
    mode,
    leftMin: 280,
    leftMax: SPATIAL_LAYOUT_LEFT_MAX_WIDTH,
    rightMin: 280,
    rightMax: SPATIAL_LAYOUT_RIGHT_MAX_WIDTH,
    rightVisible: true,
  };
}

function clampSpatialSidebarWidth(value, min, max) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return min;
  return Math.max(min, Math.min(max, Math.round(nextValue)));
}

function normalizeSpatialLayoutState(rawState, viewportWidth = getSpatialLayoutViewportWidth()) {
  const fallback = getSpatialLayoutBaselineForViewport(viewportWidth);
  const constraints = getSpatialLayoutConstraintsForViewport(viewportWidth);
  if (!rawState || typeof rawState !== 'object') {
    return { ...fallback };
  }

  if (rawState.version !== SPATIAL_LAYOUT_VERSION) {
    return { ...fallback };
  }

  const sharedState = buildSpatialStateFromLayoutSnapshot(
    {
      left_width: rawState.leftSidebarWidth,
      right_width: rawState.rightSidebarWidth,
      viewport_width: viewportWidth,
    },
    {
      viewportMode: constraints.mode,
      rightVisible: constraints.rightVisible,
    }
  );

  return {
    version: SPATIAL_LAYOUT_VERSION,
    projectId: normalizeProjectId(rawState.projectId || currentProjectId),
    leftSidebarWidth: sharedState.leftSidebarWidth,
    rightSidebarWidth: sharedState.rightSidebarWidth,
    viewportWidth,
    viewportMode: constraints.mode,
    savedAtUtc: typeof rawState.savedAtUtc === 'string' ? rawState.savedAtUtc : '',
    source: 'stored',
  };
}

function readSpatialLayoutState(projectId = currentProjectId) {
  const storageKey = getSpatialLayoutStorageKey(projectId);
  const legacyKey = 'spatialLayout';
  const raw = readWorkspaceStorage(storageKey, legacyKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistSpatialLayoutState(state, projectId = currentProjectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const nextState = {
    version: SPATIAL_LAYOUT_VERSION,
    projectId: normalizedProjectId,
    leftSidebarWidth: Math.round(Number(state?.leftSidebarWidth) || SPATIAL_LAYOUT_DESKTOP_LEFT_BASELINE_WIDTH),
    rightSidebarWidth: Math.round(Number(state?.rightSidebarWidth) || SPATIAL_LAYOUT_DESKTOP_RIGHT_BASELINE_WIDTH),
    viewportWidth: Math.max(0, Math.floor(Number(state?.viewportWidth) || getSpatialLayoutViewportWidth())),
    viewportMode: state?.viewportMode || getSpatialLayoutMode(),
    savedAtUtc: new Date().toISOString(),
    source: state?.source || 'committed',
  };
  try {
    localStorage.setItem(getSpatialLayoutStorageKey(normalizedProjectId), JSON.stringify(nextState));
  } catch {}
  spatialLayoutState = nextState;
  return nextState;
}

function applySpatialLayoutState(state, { persist = false, projectId = currentProjectId } = {}) {
  const viewportWidth = getSpatialLayoutViewportWidth();
  const normalizedState = normalizeSpatialLayoutState(state, viewportWidth);
  const constraints = getSpatialLayoutConstraintsForViewport(viewportWidth);
  const rightVisible = constraints.rightVisible;
  const layoutPatch = buildLayoutPatchFromSpatialState(normalizedState, {
    viewportWidth,
    viewportHeight: Math.max(0, Math.floor(window.innerHeight || document.documentElement.clientHeight || 0)),
    shellMode: constraints.mode === 'compact' ? 'COMPACT_DOCKED' : 'CALM_DOCKED',
    rightVisible,
  });

  if (appLayout) {
    appLayout.style.setProperty('--app-left-sidebar-width', `${layoutPatch.left_width}px`);
    appLayout.style.setProperty('--app-right-sidebar-width', `${layoutPatch.right_width}px`);
  }

  if (rightSidebar) {
    rightSidebar.hidden = !rightVisible;
  }
  if (rightSidebarResizer) {
    rightSidebarResizer.hidden = !rightVisible;
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

function restoreSpatialLayoutState(projectId = currentProjectId) {
  const storedState = readSpatialLayoutState(projectId);
  const resolvedState = normalizeSpatialLayoutState(storedState, getSpatialLayoutViewportWidth());
  return applySpatialLayoutState(resolvedState, { persist: false, projectId });
}

function commitSpatialLayoutState(projectId = currentProjectId) {
  return applySpatialLayoutState(spatialLayoutState || getSpatialLayoutBaselineForViewport(), {
    persist: true,
    projectId,
  });
}

function updateSpatialLayoutForViewportChange() {
  const storedState = readSpatialLayoutState(currentProjectId);
  const resolvedState = normalizeSpatialLayoutState(storedState || spatialLayoutState, getSpatialLayoutViewportWidth());
  applySpatialLayoutState(resolvedState, { persist: false, projectId: currentProjectId });
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
      if (!isTiptapMode) {
        focusEditorSurface('current');
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
  if (typeof node.effectivePath === 'string' && node.effectivePath) {
    return node.effectivePath;
  }
  if (node.kind === 'materials-category' || node.kind === 'reference-category') {
    return getCategoryIndexDocumentPath(node);
  }
  return node.path || '';
}

function getEffectiveDocumentKind(node) {
  if (!node) return '';
  if (typeof node.effectiveKind === 'string' && node.effectiveKind) {
    return node.effectiveKind;
  }
  if (node.kind === 'materials-category') return 'material';
  if (node.kind === 'reference-category') return 'reference';
  return node.kind || '';
}

function getTreeNodeExpandKey(node) {
  return getLeftRailPresentationExpandKey(node);
}

function getTreeNodePresentationKind(node) {
  return getLeftRailPresentationKind(node);
}

function isTreeNodeDefaultExpanded(node) {
  return isLeftRailPresentationDefaultExpanded(node);
}

function isTreeNodeImplicitlyExpanded(node) {
  if (!node) return false;
  return (
    isTreeNodeDefaultExpanded(node) ||
    node.kind === 'materials-root' ||
    node.kind === 'reference-root' ||
    node.kind === 'materials-category' ||
    node.kind === 'reference-category'
  );
}

function isTreeNodeRowExpandable(node) {
  if (!node) return false;
  return (
    node.kind === 'part' ||
    node.kind === 'chapter-folder' ||
    node.kind === 'folder' ||
    node.kind === 'roman-root' ||
    node.kind === 'roman-section-group' ||
    node.kind === 'mindmap-root' ||
    node.kind === 'print-root' ||
    node.kind === 'presentation-workspace' ||
    node.kind === 'presentation-manuscript' ||
    node.kind === 'presentation-notes'
  );
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
  if (!window.electronAPI || !window.electronAPI.openDocument) return false;
  const documentPath = getEffectiveDocumentPath(node);
  if (!documentPath) return false;
  try {
    const result = await window.electronAPI.openDocument({
      path: documentPath,
      title: node.label,
      kind: getEffectiveDocumentKind(node)
    });
    if (!result || result.ok === false) {
      if (result && result.cancelled) {
        return false;
      }
      updateStatusText('Ошибка');
      return false;
    }
    currentDocumentPath = documentPath;
    currentDocumentKind = getEffectiveDocumentKind(node);
    metaEnabled = currentDocumentKind === 'scene' || currentDocumentKind === 'chapter-file';
    updateMetaVisibility();
    updateInspectorSnapshot();
    return true;
  } catch {
    updateStatusText('Ошибка');
    return false;
  }
}

async function handleCreateNode(node, kind, promptLabel) {
  const name = window.prompt(promptLabel || 'Название', '');
  if (!name) return;
  const result = await window.electronAPI.createNode({
    parentPath: node.path,
    kind,
    name
  });
  if (!result || result.ok === false) {
    updateStatusText('Ошибка');
    return;
  }
  await loadTree();
}

async function handleRenameNode(node) {
  const name = window.prompt('Новое имя', node.label || '');
  if (!name) return;
  const result = await window.electronAPI.renameNode({ path: node.path, name });
  if (!result || result.ok === false) {
    updateStatusText('Ошибка');
    return;
  }
  if (currentDocumentPath && result.path && currentDocumentPath === node.path) {
    currentDocumentPath = result.path;
  }
  await loadTree();
}

async function handleDeleteNode(node) {
  const confirmed = window.confirm('Переместить в корзину?');
  if (!confirmed) return;
  const result = await window.electronAPI.deleteNode({ path: node.path });
  if (!result || result.ok === false) {
    updateStatusText('Ошибка');
    return;
  }
  if (currentDocumentPath && currentDocumentPath === node.path) {
    currentDocumentPath = null;
  }
  await loadTree();
    if (!currentDocumentPath) {
      collapseSelection();
    }
    updateInspectorSnapshot();
}

async function handleReorderNode(node, direction) {
  const result = await window.electronAPI.reorderNode({ path: node.path, direction });
  if (!result || result.ok === false) {
    return;
  }
  if (currentDocumentPath && result.path && currentDocumentPath === node.path) {
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
  row.dataset.kind = getTreeNodePresentationKind(node);

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
  const expandKey = getTreeNodeExpandKey(node);
  const collapsedKey = expandKey ? `collapsed:${expandKey}` : '';
  const isImplicitlyExpanded = isTreeNodeImplicitlyExpanded(node);
  const isExpanded =
    hasChildren &&
    (!collapsedKey || !expandedSet.has(collapsedKey)) &&
    ((expandKey && expandedSet.has(expandKey)) || isImplicitlyExpanded);
  if (isExpanded) {
    toggle.classList.add('is-expanded');
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!hasChildren) return;
    if (isExpanded) {
      if (isImplicitlyExpanded && collapsedKey) {
        expandedSet.add(collapsedKey);
      } else if (expandKey) {
        expandedSet.delete(expandKey);
      }
    } else {
      if (collapsedKey) expandedSet.delete(collapsedKey);
      if (expandKey) expandedSet.add(expandKey);
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
    if (hasChildren && isTreeNodeRowExpandable(node)) {
      if (isExpanded) {
        if (isImplicitlyExpanded && collapsedKey) {
          expandedSet.add(collapsedKey);
        } else if (expandKey) {
          expandedSet.delete(expandKey);
        }
      } else {
        if (collapsedKey) expandedSet.delete(collapsedKey);
        if (expandKey) expandedSet.add(expandKey);
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
  const presentationRoot = buildLeftRailPresentationTree(treeRoot);
  const nodesToRender =
    (presentationRoot.kind === 'presentation-workspace'
      ? [presentationRoot]
      : (presentationRoot.kind === 'roman-root' ? [presentationRoot] : presentationRoot.children)) || [];
  nodesToRender.forEach((child, index) => {
    list.appendChild(renderTreeNode(child, 0, index === nodesToRender.length - 1, []));
  });
  treeContainer.appendChild(list);
  renderOutlineList();
  renderSearchResults(leftSearchInput ? leftSearchInput.value : '');
  updateInspectorSnapshot();
}

async function loadTree() {
  if (!window.electronAPI || !window.electronAPI.getProjectTree) return;
  try {
    const result = await window.electronAPI.getProjectTree(activeTab);
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

function updateSpatialResizeFromClientX(clientX) {
  if (!spatialResizeDragState) return;
  const constraints = getSpatialLayoutConstraintsForViewport();
  const nextState = {
    ...(spatialLayoutState || getSpatialLayoutBaselineForViewport()),
    viewportWidth: getSpatialLayoutViewportWidth(),
    viewportMode: constraints.mode,
  };

  if (spatialResizeDragState.rightVisible) {
    if (spatialResizeDragState.side === 'left') {
      nextState.leftSidebarWidth = clampSpatialSidebarWidth(
        spatialResizeDragState.startLeftWidth + (clientX - spatialResizeDragState.startX),
        constraints.leftMin,
        constraints.leftMax
      );
    } else {
      nextState.rightSidebarWidth = clampSpatialSidebarWidth(
        spatialResizeDragState.startRightWidth + (spatialResizeDragState.startX - clientX),
        constraints.rightMin,
        constraints.rightMax
      );
    }
  } else {
    nextState.leftSidebarWidth = clampSpatialSidebarWidth(
      spatialResizeDragState.startLeftWidth + (clientX - spatialResizeDragState.startX),
      constraints.leftMin,
      constraints.leftMax
    );
  }

  applySpatialLayoutState(nextState, { persist: false, projectId: currentProjectId });
  scheduleLayoutRefresh();
}

function bindCapturedSpatialResizeStream(target, pointerId) {
  if (!(target instanceof Element)) return false;
  if (!Number.isInteger(pointerId) || typeof target.setPointerCapture !== 'function') {
    return false;
  }
  try {
    target.setPointerCapture(pointerId);
  } catch {
    return false;
  }
  target.addEventListener('pointermove', handleSpatialResizeMove);
  target.addEventListener('pointerup', stopSpatialResize);
  target.addEventListener('pointercancel', stopSpatialResize);
  target.addEventListener('lostpointercapture', stopSpatialResize);
  return true;
}

function bindWindowSpatialResizeMouseStream() {
  window.addEventListener('mousemove', handleSpatialResizeMouseMove);
  window.addEventListener('mouseup', stopSpatialResize);
}

function unbindWindowSpatialResizeMouseStream() {
  window.removeEventListener('mousemove', handleSpatialResizeMouseMove);
  window.removeEventListener('mouseup', stopSpatialResize);
}

function bindWindowSpatialResizePointerStream() {
  window.addEventListener('pointermove', handleSpatialResizeMove);
  window.addEventListener('pointerup', stopSpatialResize);
  window.addEventListener('pointercancel', stopSpatialResize);
}

function unbindWindowSpatialResizePointerStream() {
  window.removeEventListener('pointermove', handleSpatialResizeMove);
  window.removeEventListener('pointerup', stopSpatialResize);
  window.removeEventListener('pointercancel', stopSpatialResize);
}

function unbindCapturedSpatialResizeStream(target, pointerId) {
  if (!(target instanceof Element)) return;
  target.removeEventListener('pointermove', handleSpatialResizeMove);
  target.removeEventListener('pointerup', stopSpatialResize);
  target.removeEventListener('pointercancel', stopSpatialResize);
  target.removeEventListener('lostpointercapture', stopSpatialResize);
  if (
    Number.isInteger(pointerId) &&
    typeof target.hasPointerCapture === 'function' &&
    target.hasPointerCapture(pointerId) &&
    typeof target.releasePointerCapture === 'function'
  ) {
    try {
      target.releasePointerCapture(pointerId);
    } catch {}
  }
}

function startSpatialResize(side, event) {
  const draftState = spatialLayoutState || getSpatialLayoutBaselineForViewport();
  const pointerTarget = event.currentTarget instanceof Element ? event.currentTarget : null;
  const pointerId = Number.isInteger(event.pointerId) ? event.pointerId : null;
  spatialResizeDragState = {
    side,
    startX: event.clientX,
    startLeftWidth: draftState.leftSidebarWidth,
    startRightWidth: draftState.rightSidebarWidth,
    rightVisible: getSpatialLayoutConstraintsForViewport().rightVisible,
    pointerId,
    pointerTarget,
    captureBound: false,
    mouseFallbackBound: false,
    pointerFallbackBound: false,
  };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  if (bindCapturedSpatialResizeStream(pointerTarget, pointerId)) {
    spatialResizeDragState.captureBound = true;
  }
  if (event.pointerType === 'mouse') {
    if (!spatialResizeDragState.captureBound) {
      spatialResizeDragState.mouseFallbackBound = true;
      bindWindowSpatialResizeMouseStream();
    }
    return;
  }
  if (!spatialResizeDragState.captureBound) {
    spatialResizeDragState.pointerFallbackBound = true;
    bindWindowSpatialResizePointerStream();
  }
}

function handleSpatialResizeMove(event) {
  if (!spatialResizeDragState) return;
  if (
    Number.isInteger(spatialResizeDragState.pointerId) &&
    Number.isInteger(event.pointerId) &&
    event.pointerId !== spatialResizeDragState.pointerId
  ) {
    return;
  }
  updateSpatialResizeFromClientX(event.clientX);
  event.preventDefault();
}

function handleSpatialResizeMouseMove(event) {
  if (!spatialResizeDragState) return;
  if (event.buttons === 0) {
    stopSpatialResize();
    return;
  }
  updateSpatialResizeFromClientX(event.clientX);
  event.preventDefault();
}

function stopSpatialResize() {
  if (!spatialResizeDragState) return;
  const {
    pointerId,
    pointerTarget,
    captureBound,
    mouseFallbackBound,
    pointerFallbackBound,
  } = spatialResizeDragState;
  spatialResizeDragState = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  if (captureBound) {
    unbindCapturedSpatialResizeStream(pointerTarget, pointerId);
  }
  if (mouseFallbackBound) {
    unbindWindowSpatialResizeMouseStream();
  }
  if (pointerFallbackBound) {
    unbindWindowSpatialResizePointerStream();
  }
  commitSpatialLayoutState(currentProjectId);
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
      event.stopImmediatePropagation();
      return;
    }
  }
  if (
    configuratorPanel &&
    !configuratorPanel.hidden &&
    !configuratorPanel.contains(event.target) &&
    !event.target.closest('[data-grid-button]')
  ) {
    setConfiguratorOpen(false);
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
    statusElement.textContent = text;
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

function updateInspectorSnapshot() {
  if (!inspectorSnapshotElement) return;
  const snapshot = [
    `Mode=${currentMode}`,
    `DocKind=${currentDocumentKind || 'none'}`,
    `DocPath=${currentDocumentPath || 'none'}`,
    `Dirty=${localDirty ? 'true' : 'false'}`,
    `FlowMode=${flowModeState.active ? 'active' : 'off'}`,
    `CollabScopeLocal=${collabScopeLocal ? 'true' : 'false'}`,
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

function ensureCommandsOpenerInRightInspectorSurface() {
  if (!rightInspectorPanel) return null;
  const actionsHost = rightInspectorPanel.querySelector('.x101-action-buttons');
  if (!actionsHost) return null;

  let commandsButton = actionsHost.querySelector('[data-action="open-command-palette"]');
  if (!commandsButton) {
    commandsButton = document.createElement('button');
    commandsButton.type = 'button';
    commandsButton.className = 'toolbar__button toolbar__button--wide x101-action-button';
    commandsButton.dataset.action = 'open-command-palette';
    commandsButton.textContent = 'Commands';
    const settingsButton = actionsHost.querySelector('[data-action="open-settings"]');
    if (settingsButton) {
      actionsHost.insertBefore(commandsButton, settingsButton);
    } else {
      actionsHost.prepend(commandsButton);
    }
  }

  commandsButton.hidden = false;
  commandsButton.disabled = false;
  if (!commandsButton.textContent || !commandsButton.textContent.trim()) {
    commandsButton.textContent = 'Commands';
  }
  return commandsButton;
}

function normalizeRightTab(tab) {
  if (tab === 'comments') return 'comments';
  if (tab === 'history') return 'history';
  return 'inspector';
}

function applyRightTab(tab) {
  tab = normalizeRightTab(tab);
  currentRightTab = tab;
  for (const button of rightTabButtons) {
    const active = button.dataset.rightTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  if (rightInspectorPanel) rightInspectorPanel.hidden = tab !== 'inspector';
  if (rightCommentsPanel) rightCommentsPanel.hidden = tab !== 'comments';
  if (rightHistoryPanel) rightHistoryPanel.hidden = tab !== 'history';
  if (tab === 'inspector') {
    ensureCommandsOpenerInRightInspectorSurface();
  }
  syncToolbarShellState();
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
  const viewportWidth = getSpatialLayoutViewportWidth();
  const constraints = getSpatialLayoutConstraintsForViewport(viewportWidth);
  if (constraints.rightVisible) {
    const currentSpatialState = spatialLayoutState || getSpatialLayoutBaselineForViewport(viewportWidth);
    const normalizedSpatialState = normalizeSpatialLayoutState(currentSpatialState, viewportWidth);
    const hasSpatialDrift =
      normalizedSpatialState.leftSidebarWidth !== currentSpatialState.leftSidebarWidth ||
      normalizedSpatialState.rightSidebarWidth !== currentSpatialState.rightSidebarWidth ||
      normalizedSpatialState.viewportMode !== currentSpatialState.viewportMode;
    if (hasSpatialDrift) {
      applySpatialLayoutState(normalizedSpatialState, { persist: true, projectId: currentProjectId });
    }
  }
  syncLayoutPreviewVisibility();
  updateInspectorSnapshot();
  syncToolbarShellState();
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
    keysToRemove.add(getToolbarProfileStorageKey(normalizedProjectId));
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
  } catch {}
  consumeLegacyConfiguratorBuckets(localStorage);

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
  applySpatialLayoutState(getSpatialLayoutBaselineForViewport(), {
    persist: true,
    projectId: currentProjectId,
  });

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

  const nextToolbarProfileState = createToolbarConfiguratorSeedState();
  configuratorBucketState = nextToolbarProfileState;
  if (normalizeProjectId(currentProjectId)) {
    writeToolbarConfiguratorStoredState(currentProjectId, nextToolbarProfileState);
  }
  renderToolbarConfiguratorProfileSwitch();
  renderToolbarConfiguratorBuckets();
  setConfiguratorOpen(false);
  setToolbarSpacingTuningMode(false);
  setToolbarSpacingMenuOpen(false);
  setLeftToolbarSpacingTuningMode(false);
  setLeftToolbarSpacingMenuOpen(false);
  projectMainFloatingToolbarRuntime('safe-reset-shell');

  if (leftSearchInput) {
    leftSearchInput.value = '';
    renderSearchResults('');
  }

  closeSimpleModal(settingsModal);
  closeSimpleModal(recoveryModal);
  closeSimpleModal(exportPreviewModal);
  closeSimpleModal(diagnosticsModal);

  applyMode('write');
  applyLeftTab('project');
  applyRightTab('inspector');
  loadTree();
  updateWordCount();
  updateSaveStateText(localDirty ? 'unsaved' : 'idle');
  updateWarningStateText('none');
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
  restoreSpatialLayoutState(currentProjectId);

  adoptToolbarConfiguratorState(currentProjectId);
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
  updateWarningStateText('recovery restored');
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

function filterCommandPaletteEntries(entries, rawQuery) {
  const query = typeof rawQuery === 'string' ? rawQuery.trim().toLowerCase() : '';
  if (!query) return entries.slice();
  return entries.filter((entry) => {
    const label = typeof entry?.label === 'string' ? entry.label.toLowerCase() : '';
    const id = typeof entry?.id === 'string' ? entry.id.toLowerCase() : '';
    const hotkey = typeof entry?.hotkey === 'string' ? entry.hotkey.toLowerCase() : '';
    return label.includes(query) || id.includes(query) || hotkey.includes(query);
  });
}

function renderCommandPaletteList(rawQuery = '') {
  if (!commandPaletteList || typeof document === 'undefined') return;
  const sourceEntries =
    commandPaletteDataProvider && typeof commandPaletteDataProvider.listAll === 'function'
      ? commandPaletteDataProvider.listAll()
      : [];
  const entries = filterCommandPaletteEntries(Array.isArray(sourceEntries) ? sourceEntries : [], rawQuery);
  const fragment = document.createDocumentFragment();
  commandPaletteList.innerHTML = '';
  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const commandId = typeof entry.id === 'string' ? entry.id : '';
    if (!commandId) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'modal__button';
    button.dataset.commandPaletteCommandId = commandId;
    const label = typeof entry.label === 'string' && entry.label.length > 0 ? entry.label : commandId;
    const hotkey = typeof entry.hotkey === 'string' && entry.hotkey.length > 0 ? ` (${entry.hotkey})` : '';
    button.textContent = `${label}${hotkey}`;
    fragment.append(button);
  });
  commandPaletteList.append(fragment);
  if (commandPaletteSummary) {
    commandPaletteSummary.textContent =
      entries.length > 0 ? `Commands available: ${entries.length}` : 'No commands found';
  }
}

function ensureCommandPaletteSearchFieldVisible() {
  if (!commandPaletteSearchInput) return;
  commandPaletteSearchInput.hidden = false;
  commandPaletteSearchInput.disabled = false;
  commandPaletteSearchInput.readOnly = false;
  commandPaletteSearchInput.tabIndex = 0;
  if (typeof commandPaletteSearchInput.removeAttribute === 'function') {
    commandPaletteSearchInput.removeAttribute('hidden');
    commandPaletteSearchInput.removeAttribute('disabled');
    commandPaletteSearchInput.removeAttribute('readonly');
  }
  if (commandPaletteSearchInput.style) {
    commandPaletteSearchInput.style.display = 'block';
    commandPaletteSearchInput.style.visibility = 'visible';
    commandPaletteSearchInput.style.opacity = '1';
    commandPaletteSearchInput.style.pointerEvents = 'auto';
    commandPaletteSearchInput.style.minHeight = '36px';
  }
}

function openCommandPaletteModal() {
  ensureCommandPaletteSearchFieldVisible();
  if (commandPaletteSearchInput) {
    commandPaletteSearchInput.value = '';
  }
  renderCommandPaletteList('');
  openSimpleModal(commandPaletteModal);
  commandPaletteSearchInput?.focus();
}

function runCommandPaletteAction(commandId) {
  if (typeof commandId !== 'string' || commandId.trim().length === 0) return;
  closeSimpleModal(commandPaletteModal);
  return dispatchUiCommand(commandId.trim());
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
  updateWarningStateText('none');
}

function applyCollabGate() {
  applyRightTab(currentRightTab);
  updateInspectorSnapshot();
}

async function initializeCollabScopeLocal() {
  try {
    if (window.electronAPI && typeof window.electronAPI.getCollabScopeLocal === 'function') {
      collabScopeLocal = await window.electronAPI.getCollabScopeLocal();
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
        updateWarningStateText('network blocked before X4');
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
  const metrics = getPageMetrics({
    profile: activeBookProfileState,
    zoom: editorZoom,
  });
  if (metrics) {
    applyPageGeometryCssVars(metrics);
  }
  applyPreviewChromeCssVars(activePreviewChromeState, document.documentElement, editorZoom, PX_PER_MM_AT_ZOOM_1);
  scheduleLayoutPreviewRefresh();
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
    ensureSelectHasOption(sizeSelect, String(px), String(px), '__custom_size__');
    sizeSelect.value = String(px);
  }
  syncLiteralToolbarDisplays();
}

function scheduleAutoSave(delay = AUTO_SAVE_DELAY) {
  if (!window.electronAPI || typeof window.electronAPI.requestAutoSave !== 'function') {
    return;
  }

  if (autoSaveTimerId) {
    clearTimeout(autoSaveTimerId);
  }

  autoSaveTimerId = window.setTimeout(() => {
    window.electronAPI
      .requestAutoSave()
      .catch(() => {})
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
    if (window.electronAPI && window.electronAPI.notifyDirtyState) {
      window.electronAPI.notifyDirtyState(true);
    }
  }
  updateSaveStateText('unsaved');
  updatePerfHintText('typing');
  updateInspectorSnapshot();
  scheduleAutoSave();
}

function normalizeFontWeightPreset(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (FONT_WEIGHT_PRESETS[raw]) {
    return raw;
  }
  return LEGACY_FONT_WEIGHT_PRESET_MAP[raw] || 'light';
}

function ensureSelectHasOption(select, value, label = value, beforeValue = '') {
  if (!(select instanceof HTMLSelectElement)) return;
  const stringValue = String(value);
  const existing = Array.from(select.options).find((option) => option.value === stringValue);
  if (existing) {
    existing.textContent = label;
    return;
  }
  const option = new Option(label, stringValue);
  const beforeOption = beforeValue
    ? Array.from(select.options).find((candidate) => candidate.value === beforeValue) || null
    : null;
  select.add(option, beforeOption);
}

function applyFontWeight(weightPreset, persist = true) {
  if (!editor) return;
  const presetId = normalizeFontWeightPreset(weightPreset);
  const preset = FONT_WEIGHT_PRESETS[presetId] || FONT_WEIGHT_PRESETS.light;
  editor.style.fontWeight = preset.weight;
  editor.style.fontStretch = preset.stretch;
  editor.style.letterSpacing = preset.spacing;
  if (weightSelect) {
    weightSelect.value = presetId;
  }
  if (persist) {
    localStorage.setItem('editorFontWeight', presetId);
  }
  syncLiteralToolbarDisplays();
  renderStyledView(getPlainText());
}

function applyLineHeight(value, persist = true) {
  if (!editor) return;
  editor.style.lineHeight = String(value);
  if (lineHeightSelect) {
    ensureSelectHasOption(lineHeightSelect, String(value), String(value), '__custom_line_height__');
    lineHeightSelect.value = String(value);
  }
  if (persist) {
    localStorage.setItem('editorLineHeight', String(value));
  }
  syncLiteralToolbarDisplays();
  renderStyledView(getPlainText());
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
}

function applyTextStyle(action) {
  if (!editor || !action) {
    return { performed: false, action: 'applyTextStyle', reason: 'EDITOR_UNAVAILABLE', optionId: action || '' };
  }
  if (isTiptapMode) {
    const tiptapResult = action.startsWith('paragraph-')
      ? applyTiptapParagraphStyle(action)
      : (action.startsWith('character-')
        ? applyTiptapCharacterStyle(action)
        : { performed: false, action: 'applyTextStyle', reason: 'UNSUPPORTED_STYLE_OPTION', optionId: action });
    if (tiptapResult && tiptapResult.performed !== false) {
      markAsModified();
      updateWordCount();
    }
    syncToolbarFormattingState();
    return tiptapResult;
  }
  const text = getPlainText();
  const { start: rawStart, end: rawEnd } = getSelectionOffsets();
  const boundedStart = Math.max(0, Math.min(rawStart, rawEnd));
  const boundedEnd = Math.max(0, Math.max(rawStart, rawEnd));
  const start = Math.min(boundedStart, text.length);
  const end = Math.min(boundedEnd, text.length);
  let result = null;
  let actionId = 'applyTextStyle';

  if (action.startsWith('character-') && start === end) {
    updateStatusText('Выделите текст');
    return { performed: false, action: 'applyCharacterStyle', reason: 'NO_SELECTION', optionId: action };
  }

  if (action.startsWith('paragraph-')) {
    actionId = 'applyParagraphStyle';
    result = applyParagraphStyle(text, start, end, action);
  } else if (action.startsWith('character-')) {
    actionId = 'applyCharacterStyle';
    result = applyCharacterStyle(text, start, end, action);
  }

  if (!result) {
    return { performed: false, action: actionId, reason: 'NO_OP', optionId: action };
  }
  setPlainText(result.newText);
  setSelectionRange(result.newStart, result.newEnd);
  markAsModified();
  updateWordCount();
  return { performed: true, action: actionId, reason: null, optionId: action };
}

function updateAlignmentButtons(activeAction) {
  if (!alignButtons.length) return;
  alignButtons.forEach((button) => {
    const isActive = button.dataset.paragraphAlignment === activeAction;
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
  if (isTiptapMode) return;
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
    syncLiteralToolbarDisplays();
  }

function syncLiteralToolbarDisplays() {
  if (fontDisplay && fontSelect) {
    const option = fontSelect.options[fontSelect.selectedIndex];
    fontDisplay.textContent = option?.textContent || 'Roboto Ms';
  }
  if (weightDisplay && weightSelect) {
    const option = weightSelect.options[weightSelect.selectedIndex];
    weightDisplay.textContent = option?.textContent || 'Light';
  }
  if (sizeDisplay && sizeSelect) {
    const option = sizeSelect.options[sizeSelect.selectedIndex];
    sizeDisplay.textContent = option?.textContent || String(currentFontSizePx);
  }
  if (lineHeightDisplay && lineHeightSelect) {
    const option = lineHeightSelect.options[lineHeightSelect.selectedIndex];
    lineHeightDisplay.textContent = option?.value && !option.value.startsWith('__')
      ? option.value
      : String(editor?.style.lineHeight || '1.0');
  }
}

function promptForCustomFontSize() {
  const response = window.prompt('Font size (px)', String(currentFontSizePx));
  if (response === null) return;
  const nextSize = Number(response);
  if (!Number.isFinite(nextSize) || nextSize <= 0) {
    updateStatusText('Некорректный размер шрифта');
    if (sizeSelect) {
      sizeSelect.value = String(currentFontSizePx);
    }
    return;
  }
  const normalizedSize = Math.round(nextSize);
  ensureSelectHasOption(sizeSelect, String(normalizedSize), String(normalizedSize), '__custom_size__');
  window.electronAPI?.setFontSizePx(normalizedSize);
}

function promptForCustomLineHeight() {
  const currentValue = lineHeightSelect?.value && !lineHeightSelect.value.startsWith('__')
    ? lineHeightSelect.value
    : String(editor?.style.lineHeight || '1.0');
  const response = window.prompt('Line height', currentValue);
  if (response === null) return;
  const nextValue = Number(response);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    updateStatusText('Некорректный интерлиньяж');
    if (lineHeightSelect) {
      lineHeightSelect.value = String(editor?.style.lineHeight || '1.0');
    }
    return;
  }
  const normalizedValue = String(Number(nextValue.toFixed(3)));
  ensureSelectHasOption(lineHeightSelect, normalizedValue, normalizedValue, '__custom_line_height__');
  applyLineHeight(normalizedValue);
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
  syncLiteralToolbarDisplays();
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
  focusEditorSurface('current');
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

function normalizeToolbarLinkPromptCandidate(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeToolbarLinkPromptValue(value) {
  const raw = normalizeToolbarLinkPromptCandidate(value);
  if (!raw) {
    return { ok: true, href: '' };
  }
  if (/\s/.test(raw)) {
    return { ok: false, reason: 'UNSAFE_SCHEME' };
  }

  let normalized = raw;
  const lower = raw.toLowerCase();
  if (
    lower.startsWith('http://')
    || lower.startsWith('https://')
    || lower.startsWith('mailto:')
  ) {
    normalized = raw;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return { ok: false, reason: 'UNSAFE_SCHEME' };
  } else if (raw.startsWith('www.') || /^[^/\s]+\.[^\s]+/.test(raw)) {
    normalized = `https://${raw}`;
  }

  try {
    const parsed = new URL(normalized);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'mailto:') {
      return { ok: false, reason: 'UNSAFE_SCHEME' };
    }
    if (protocol === 'mailto:' && !parsed.pathname) {
      return { ok: false, reason: 'UNSAFE_SCHEME' };
    }
    return { ok: true, href: parsed.href };
  } catch {
    return { ok: false, reason: 'UNSAFE_SCHEME' };
  }
}

function readToolbarLinkPromptInitialValue(payload, state) {
  const input = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  const payloadHref = normalizeToolbarLinkPromptCandidate(input.href || input.initialHref || input.initialValue);
  if (payloadHref) {
    return payloadHref;
  }
  return normalizeToolbarLinkPromptCandidate(state.linkHref);
}

function normalizeToolbarFormattingState(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : {};
  return {
    bold: Boolean(source.bold),
    italic: Boolean(source.italic),
    underline: Boolean(source.underline),
    textColor: typeof source.textColor === 'string' ? source.textColor : '',
    textColorActive: Boolean(source.textColorActive || (typeof source.textColor === 'string' && source.textColor.length > 0)),
    highlightColor: typeof source.highlightColor === 'string' ? source.highlightColor : '',
    highlightActive: Boolean(source.highlightActive || (typeof source.highlightColor === 'string' && source.highlightColor.length > 0)),
    bulletList: Boolean(source.bulletList),
    orderedList: Boolean(source.orderedList),
    link: Boolean(source.link || source.linkActive),
    linkHref: typeof source.linkHref === 'string' ? source.linkHref : '',
    paragraphStyle: typeof source.paragraphStyle === 'string' ? source.paragraphStyle : '',
    characterStyle: typeof source.characterStyle === 'string' ? source.characterStyle : '',
    selectionEmpty: source.selectionEmpty !== false,
  };
}

function normalizeToolbarColorPickerMode(mode) {
  return mode === 'highlight' ? 'highlight' : 'text';
}

function getToolbarColorPickerSwatches(mode) {
  return TOOLBAR_COLOR_PICKER_MODE_SWATCHES[normalizeToolbarColorPickerMode(mode)] || [];
}

function renderToolbarColorPickerOverlay() {
  if (!(toolbarColorPickerOverlay instanceof HTMLElement)) return;
  const mode = normalizeToolbarColorPickerMode(toolbarColorPickerState.mode);
  const isOpen = Boolean(toolbarColorPickerState.open);
  const selectedValue = toolbarColorPickerState.selectedByMode[mode] || '';

  toolbarColorPickerOverlay.hidden = !isOpen;
  toolbarColorPickerOverlay.dataset.toolbarColorPickerMode = mode;
  toolbarColorPickerOverlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

  if (toolbarColorPickerTitle instanceof HTMLElement) {
    toolbarColorPickerTitle.textContent = TOOLBAR_COLOR_PICKER_MODE_LABELS[mode] || mode;
  }

  if (toolbarColorPickerSwatchHost instanceof HTMLElement) {
    toolbarColorPickerSwatchHost.replaceChildren();

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'toolbar__swatch toolbar__swatch--clear';
    clearButton.dataset.toolbarColorSwatchValue = '';
    clearButton.setAttribute('aria-label', `Clear ${TOOLBAR_COLOR_PICKER_MODE_LABELS[mode] || mode.toLowerCase()}`);
    clearButton.setAttribute('aria-pressed', selectedValue === '' ? 'true' : 'false');
    clearButton.classList.toggle('is-active', selectedValue === '');
    clearButton.textContent = '×';
    toolbarColorPickerSwatchHost.appendChild(clearButton);

    for (const swatch of getToolbarColorPickerSwatches(mode)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toolbar__swatch';
      button.dataset.toolbarColorSwatchValue = swatch.value;
      button.setAttribute('aria-label', swatch.label);
      button.setAttribute('aria-pressed', swatch.value === selectedValue ? 'true' : 'false');
      button.classList.toggle('is-active', swatch.value === selectedValue);
      button.style.setProperty('--swatch-color', swatch.value);
      toolbarColorPickerSwatchHost.appendChild(button);
    }
  }

  if (toolbarColorPickerCloseButton instanceof HTMLElement) {
    toolbarColorPickerCloseButton.setAttribute('aria-label', `Close ${TOOLBAR_COLOR_PICKER_MODE_LABELS[mode] || mode.toLowerCase()}`);
  }
}

function setToolbarColorPickerOpen(nextOpen, nextMode = toolbarColorPickerState.mode) {
  const mode = normalizeToolbarColorPickerMode(nextMode);
  if (nextOpen) {
    setParagraphMenuOpen(false);
    setListMenuOpen(false);
    setToolbarSpacingMenuOpen(false);
    setToolbarStylesMenuOpen(false);
  }
  toolbarColorPickerState = {
    ...toolbarColorPickerState,
    open: Boolean(nextOpen),
    mode,
  };
  if (nextOpen && isTiptapMode) {
    const state = normalizeToolbarFormattingState(getTiptapFormattingState());
    toolbarColorPickerState = {
      ...toolbarColorPickerState,
      selectedByMode: {
        ...toolbarColorPickerState.selectedByMode,
        text: state.textColor,
        highlight: state.highlightColor,
      },
    };
  }
  syncToolbarShellState();
}

function setToolbarColorPickerSelection(nextValue) {
  const mode = normalizeToolbarColorPickerMode(toolbarColorPickerState.mode);
  const value = typeof nextValue === 'string' ? nextValue.trim().toLowerCase() : '';
  const result = mode === 'highlight'
    ? (value
      ? handleTiptapFormatCommand('setHighlight', { value })
      : handleTiptapFormatCommand('unsetHighlight'))
    : (value
      ? handleTiptapFormatCommand('setColor', { value })
      : handleTiptapFormatCommand('unsetColor'));
  toolbarColorPickerState = {
    ...toolbarColorPickerState,
    selectedByMode: {
      ...toolbarColorPickerState.selectedByMode,
      [mode]: result && result.performed !== false ? value : toolbarColorPickerState.selectedByMode[mode],
    },
    open: false,
  };
  syncToolbarShellState();
  return result;
}

function resolveToolbarColorButtonForMode(mode) {
  return normalizeToolbarColorPickerMode(mode) === 'highlight'
    ? colorHighlightButton
    : colorTextButton;
}

function positionToolbarColorPickerOverlay() {
  if (!(toolbarColorPickerOverlay instanceof HTMLElement) || !(toolbarShell instanceof HTMLElement)) return;
  const anchorButton = resolveToolbarColorButtonForMode(toolbarColorPickerState.mode);
  if (!(anchorButton instanceof HTMLElement)) return;

  const shellRect = toolbarShell.getBoundingClientRect();
  const anchorRect = anchorButton.getBoundingClientRect();
  const overlayRect = toolbarColorPickerOverlay.getBoundingClientRect();
  const rawLeft = anchorRect.left - shellRect.left + ((anchorRect.width - overlayRect.width) / 2);
  const maxLeft = Math.max(0, shellRect.width - overlayRect.width);
  const left = Math.min(Math.max(0, rawLeft), maxLeft);
  const top = anchorRect.bottom - shellRect.top + 10;
  toolbarColorPickerOverlay.style.left = `${left}px`;
  toolbarColorPickerOverlay.style.top = `${top}px`;
}

function syncToolbarShellState() {
  if (colorTextButton instanceof HTMLElement) {
    colorTextButton.classList.toggle('is-open', toolbarColorPickerState.open && toolbarColorPickerState.mode === 'text');
    colorTextButton.setAttribute('aria-label', 'Text color');
  }
  if (colorHighlightButton instanceof HTMLElement) {
    colorHighlightButton.classList.toggle('is-open', toolbarColorPickerState.open && toolbarColorPickerState.mode === 'highlight');
    colorHighlightButton.setAttribute('aria-label', 'Highlight color');
  }
  if (reviewCommentsButton instanceof HTMLElement) {
    const isActive = currentRightTab === 'comments';
    reviewCommentsButton.classList.toggle('is-pressed', isActive);
    reviewCommentsButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    reviewCommentsButton.setAttribute('aria-label', 'Open comments');
  }
  if (styleParagraphButton instanceof HTMLElement) {
    styleParagraphButton.classList.toggle(
      'is-open',
      toolbarStylesMenuState.open && toolbarStylesMenuState.anchor === TOOLBAR_STYLES_MENU_ANCHORS.paragraph,
    );
    styleParagraphButton.classList.toggle('is-active', toolbarStylesMenuState.selectedByKind.paragraph.length > 0);
    styleParagraphButton.setAttribute(
      'aria-expanded',
      toolbarStylesMenuState.open && toolbarStylesMenuState.anchor === TOOLBAR_STYLES_MENU_ANCHORS.paragraph ? 'true' : 'false',
    );
  }
  if (styleCharacterButton instanceof HTMLElement) {
    styleCharacterButton.classList.toggle(
      'is-open',
      toolbarStylesMenuState.open && toolbarStylesMenuState.anchor === TOOLBAR_STYLES_MENU_ANCHORS.character,
    );
    styleCharacterButton.classList.toggle('is-active', toolbarStylesMenuState.selectedByKind.character.length > 0);
    styleCharacterButton.setAttribute(
      'aria-expanded',
      toolbarStylesMenuState.open && toolbarStylesMenuState.anchor === TOOLBAR_STYLES_MENU_ANCHORS.character ? 'true' : 'false',
    );
  }
  if (toolbarColorPickerOverlay instanceof HTMLElement) {
    toolbarColorPickerOverlay.classList.toggle('is-open', toolbarColorPickerState.open);
    toolbarColorPickerOverlay.dataset.toolbarColorPickerMode = normalizeToolbarColorPickerMode(toolbarColorPickerState.mode);
    if (toolbarColorPickerState.open) {
      positionToolbarColorPickerOverlay();
    } else {
      toolbarColorPickerOverlay.style.left = '';
      toolbarColorPickerOverlay.style.top = '';
    }
  }
  paragraphStyleOptionButtons.forEach((button) => {
    const optionId = button.getAttribute('data-style-paragraph-option') || '';
    const active = optionId.length > 0 && optionId === toolbarStylesMenuState.selectedByKind.paragraph;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  characterStyleOptionButtons.forEach((button) => {
    const optionId = button.getAttribute('data-style-character-option') || '';
    const active = optionId.length > 0 && optionId === toolbarStylesMenuState.selectedByKind.character;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  renderToolbarColorPickerOverlay();
}

function updateToolbarPressedButton(button, active) {
  if (!(button instanceof HTMLElement)) return;
  button.classList.toggle('is-pressed', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.disabled = !isTiptapMode;
}

function syncToolbarFormattingState(nextState = null) {
  const state = isTiptapMode
    ? normalizeToolbarFormattingState(nextState || getTiptapFormattingState())
    : normalizeToolbarFormattingState();
  updateToolbarPressedButton(formatBoldButton, state.bold);
  updateToolbarPressedButton(formatItalicButton, state.italic);
  updateToolbarPressedButton(formatUnderlineButton, state.underline);
  updateToolbarPressedButton(insertLinkButton, state.link);
  if (colorTextButton instanceof HTMLElement) {
    updateToolbarPressedButton(colorTextButton, state.textColorActive);
  }
  if (colorHighlightButton instanceof HTMLElement) {
    updateToolbarPressedButton(colorHighlightButton, state.highlightActive);
  }
  toolbarColorPickerState = {
    ...toolbarColorPickerState,
    selectedByMode: {
      text: state.textColor,
      highlight: state.highlightColor,
    },
  };
  toolbarStylesMenuState = {
    ...toolbarStylesMenuState,
    selectedByKind: {
      paragraph: state.paragraphStyle,
      character: state.characterStyle,
    },
  };

  if (listTriggerButton instanceof HTMLElement) {
    const hasList = state.bulletList || state.orderedList;
    listTriggerButton.classList.toggle('is-active', hasList);
    listTriggerButton.disabled = !isTiptapMode;
  }

  listActionButtons.forEach((button) => {
    const action = button.dataset.listAction || '';
    const active = (action === 'bullet' && state.bulletList)
      || (action === 'ordered' && state.orderedList)
      || (action === 'no-list' && !state.bulletList && !state.orderedList);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  syncToolbarShellState();
}

function handleToggleStylesMenu(anchor) {
  const normalizedAnchor = normalizeToolbarStylesMenuAnchor(anchor);
  const isOpen = toolbarStylesMenu instanceof HTMLElement
    && !toolbarStylesMenu.hidden
    && toolbarStylesMenuState.anchor === normalizedAnchor;
  setToolbarStylesMenuOpen(!isOpen, normalizedAnchor);
  syncToolbarShellState();
  return { performed: true, action: 'toggleStylesMenu', reason: null, optionId: normalizedAnchor };
}

function handleStyleParagraphMenu() {
  return handleToggleStylesMenu(TOOLBAR_STYLES_MENU_ANCHORS.paragraph);
}

function handleStyleCharacterMenu() {
  return handleToggleStylesMenu(TOOLBAR_STYLES_MENU_ANCHORS.character);
}

function handleFormatTextColorPicker() {
  if (!isTiptapMode) {
    return { performed: false, action: 'textColorPicker', reason: 'EDITOR_MODE_UNSUPPORTED' };
  }
  const isOpen = toolbarColorPickerOverlay instanceof HTMLElement
    && !toolbarColorPickerOverlay.hidden
    && toolbarColorPickerState.mode === 'text';
  setToolbarColorPickerOpen(!isOpen, 'text');
  return { performed: true, action: 'textColorPicker', reason: null };
}

function handleFormatHighlightColorPicker() {
  if (!isTiptapMode) {
    return { performed: false, action: 'highlightColorPicker', reason: 'EDITOR_MODE_UNSUPPORTED' };
  }
  const isOpen = toolbarColorPickerOverlay instanceof HTMLElement
    && !toolbarColorPickerOverlay.hidden
    && toolbarColorPickerState.mode === 'highlight';
  setToolbarColorPickerOpen(!isOpen, 'highlight');
  return { performed: true, action: 'highlightColorPicker', reason: null };
}

function handleReviewOpenComments() {
  setToolbarColorPickerOpen(false);
  setToolbarStylesMenuOpen(false);
  if (currentMode === 'review' && currentRightTab === 'comments') {
    syncToolbarShellState();
    return { performed: true, action: 'reviewOpenComments', reason: null };
  }
  applyMode('review');
  applyRightTab('comments');
  syncToolbarShellState();
  return { performed: true, action: 'reviewOpenComments', reason: null };
}

function handleTiptapFormatCommand(commandName, payload = {}) {
  if (!isTiptapMode) {
    return { performed: false, action: commandName, reason: 'EDITOR_MODE_UNSUPPORTED' };
  }
  const result = runTiptapFormatCommand(commandName, payload);
  if (result && result.performed !== false) {
    markAsModified();
    updateWordCount();
  }
  syncToolbarFormattingState();
  return result;
}

function handleInsertLinkPrompt(payload = {}) {
  if (!isTiptapMode) {
    return { performed: false, action: 'insertLinkPrompt', reason: 'EDITOR_MODE_UNSUPPORTED' };
  }

  const state = normalizeToolbarFormattingState(getTiptapFormattingState());
  if (state.selectionEmpty && !state.link) {
    syncToolbarFormattingState(state);
    return { performed: false, action: 'insertLinkPrompt', reason: 'NO_SELECTION' };
  }
  if (typeof window.prompt !== 'function') {
    return { performed: false, action: 'insertLinkPrompt', reason: 'PROMPT_UNAVAILABLE' };
  }

  const response = window.prompt(LINK_PROMPT_TITLE, readToolbarLinkPromptInitialValue(payload, state));
  if (response === null) {
    return { performed: false, action: 'insertLinkPrompt', reason: 'USER_CANCELLED' };
  }

  const normalized = normalizeToolbarLinkPromptValue(response);
  if (!normalized.ok) {
    syncToolbarFormattingState(state);
    return { performed: false, action: 'insertLinkPrompt', reason: normalized.reason };
  }
  if (!normalized.href) {
    if (!state.link) {
      syncToolbarFormattingState(state);
      return { performed: false, action: 'insertLinkPrompt', reason: 'NO_OP' };
    }
    return handleTiptapFormatCommand('unsetLink');
  }

  return handleTiptapFormatCommand('setLink', { href: normalized.href });
}

function dispatchListTypeAction(listAction) {
  switch (listAction) {
    case 'no-list':
      return dispatchUiCommand(EXTRA_COMMAND_IDS.LIST_CLEAR);
    case 'bullet':
      return dispatchUiCommand(EXTRA_COMMAND_IDS.LIST_TOGGLE_BULLET);
    case 'ordered':
      return dispatchUiCommand(EXTRA_COMMAND_IDS.LIST_TOGGLE_ORDERED);
    default:
      return Promise.resolve({ ok: false, error: { reason: 'LIST_ACTION_UNKNOWN' } });
  }
}

async function handlePlanFlowSave() {
  await handleFlowModeSaveUiPath();
  return { performed: true };
}

async function handleReviewExportMarkdown() {
  await handleMarkdownExportUiPath();
  return { performed: true };
}

function handleUiAction(action) {
  switch (action) {
    case 'toggle-configurator':
      toggleConfiguratorOpen();
      return true;
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
      commitSpatialLayoutState(currentProjectId);
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
      window.electronAPI?.setTheme('dark');
      return true;
    case 'theme-light':
      window.electronAPI?.setTheme('light');
      return true;
    case 'toggle-wrap':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_WRAP);
      return true;
    case 'toggle-preview':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW);
      return true;
    case 'toggle-preview-frame':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW_FRAME);
      return true;
    case 'zoom-out':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_ZOOM_OUT);
      return true;
    case 'zoom-in':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_ZOOM_IN);
      return true;
    case 'toggle-paragraph-menu':
      setParagraphMenuOpen(!(paragraphMenu && !paragraphMenu.hidden));
      return true;
    case 'toggle-list-menu':
      setListMenuOpen(!(listMenu && !listMenu.hidden));
      return true;
    case 'toggle-style-paragraph-menu':
      handleStyleParagraphMenu();
      return true;
    case 'toggle-style-character-menu':
      handleStyleCharacterMenu();
      return true;
    case 'format-bold':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_BOLD);
      return true;
    case 'format-italic':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_ITALIC);
      return true;
    case 'format-underline':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_UNDERLINE);
      return true;
    case 'color-text':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TEXT_COLOR_PICKER);
      return true;
    case 'color-highlight':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_HIGHLIGHT_COLOR_PICKER);
      return true;
    case 'insert-link':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_LINK_PROMPT);
      return true;
    case 'review-open-comments':
      void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_OPEN_COMMENTS);
      return true;
    case 'toolbar-color-picker-close':
      setToolbarColorPickerOpen(false);
      return true;
    case 'undo':
      return handleUndo().performed !== false;
    case 'redo':
      return handleRedo().performed !== false;
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
    case 'open-command-palette':
      openCommandPaletteModal();
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

function triggerLeftToolbarAction(action) {
  if (typeof action !== 'string' || action.length === 0) return false;
  switch (action) {
    case 'search':
      {
        const result = handleFind();
        if (!result || result.performed !== true) {
          applyLeftTab('search');
          leftSearchInput?.focus();
        }
      }
      return true;
    case 'new':
      if (window.electronAPI && typeof window.electronAPI.fileOpen === 'function') {
        void window.electronAPI.fileOpen({ intent: 'new' });
        return true;
      }
      break;
    case 'open':
      if (window.electronAPI && typeof window.electronAPI.fileOpen === 'function') {
        void window.electronAPI.fileOpen({ intent: 'open' });
        return true;
      }
      break;
    case 'toggle-configurator':
      toggleConfiguratorOpen();
      return true;
    default:
      break;
  }
  return handleUiAction(action);
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (handleUiAction(action)) {
    event.preventDefault();
  }
});

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
    window.electronAPI?.setFont(event.target.value);
  });
}

if (weightSelect) {
  weightSelect.addEventListener('change', (event) => {
    applyFontWeight(event.target.value);
  });
}

if (sizeSelect) {
  sizeSelect.addEventListener('change', (event) => {
    if (event.target.value === '__custom_size__') {
      promptForCustomFontSize();
      return;
    }
    const nextSize = Number(event.target.value);
    if (Number.isFinite(nextSize)) {
      window.electronAPI?.setFontSizePx(nextSize);
    }
  });
}

if (lineHeightSelect) {
  lineHeightSelect.addEventListener('change', (event) => {
    if (event.target.value === '__custom_line_height__') {
      promptForCustomLineHeight();
      return;
    }
    applyLineHeight(event.target.value);
  });
}

function loadSavedViewMode() {
  const saved = localStorage.getItem('editorViewMode') || 'default';
  applyViewMode(saved, false);
}

function loadSavedFontWeight() {
  const saved = localStorage.getItem('editorFontWeight');
  if (saved) {
    applyFontWeight(saved, false);
    if (weightSelect) {
      weightSelect.value = normalizeFontWeightPreset(saved);
    }
  } else {
    applyFontWeight('light', false);
    if (weightSelect) {
      weightSelect.value = 'light';
    }
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

function applyLiteralToolbarMasterVisualDefaults() {
  if (!document.body.classList.contains('literal-stage-a')) return;
  if (fontSelect) {
    const literalFont = '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    fontSelect.value = literalFont;
    applyFont(literalFont);
  }
  if (weightSelect) {
    weightSelect.value = 'light';
  }
  if (lineHeightSelect) {
    lineHeightSelect.value = '1.0';
  }
  applyFontWeight('light', false);
  if (editor) {
    editor.style.fontSize = '12px';
  }
  setCurrentFontSize(12);
  syncLiteralToolbarDisplays();
}

loadSavedViewMode();
loadSavedFontWeight();
loadSavedLineHeight();
loadSavedWordWrap();
loadSavedEditorZoom();
applyLiteralToolbarMasterVisualDefaults();

setPlainText('');
restoreSpatialLayoutState(currentProjectId);
metaPanel?.classList.add('is-hidden');
updateSaveStateText('idle');
updateWarningStateText('none');
updatePerfHintText('normal');
updateInspectorSnapshot();
applyMode('write');
applyLeftTab('project');
applyRightTab('inspector');
ensureCommandsOpenerInRightInspectorSurface();
installNetworkGuard();
void initializeCollabScopeLocal();
initializeToolbarConfiguratorFoundation();
showEditorPanelFor('Yalken');
updateWordCount();
initializeFloatingToolbarSpacingMenu();
initializeFloatingToolbarParagraphMenu();
initializeFloatingToolbarListMenu();
initializeFloatingToolbarColorPickerOverlay();
initializeFloatingToolbarStylesMenu();
syncToolbarFormattingState();
if (isTiptapMode) {
  setTiptapFormattingStateHandler(syncToolbarFormattingState);
}
initializeFloatingToolbarItemOffsetTuning();
initializeFloatingToolbarDragFoundation();
initializeLeftToolbarSpacingMenu();
initializeLeftToolbarButtonOffsetTuning();
initializeLeftToolbarActionButtons();
initializeLeftFloatingToolbarDragFoundation();

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
    if (tab === 'inspector' || tab === 'comments' || tab === 'history') {
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
    window.electronAPI?.setTheme(nextTheme);
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
if (commandPaletteSearchInput) {
  commandPaletteSearchInput.addEventListener('input', () => {
    renderCommandPaletteList(commandPaletteSearchInput.value);
  });
}
if (commandPaletteList) {
  commandPaletteList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-command-palette-command-id]');
    if (!button) return;
    void runCommandPaletteAction(button.dataset.commandPaletteCommandId || '');
  });
}
commandPaletteCloseButtons.forEach((button) => {
  button.addEventListener('click', () => closeSimpleModal(commandPaletteModal));
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
  if (event.key === 'Escape' && configuratorPanel && !configuratorPanel.hidden) {
    event.preventDefault();
    setConfiguratorOpen(false);
    return;
  }
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
document.addEventListener('selectionchange', syncToolbarFormattingState);

window.addEventListener('resize', () => {
  updateSpatialLayoutForViewportChange();
  scheduleLayoutRefresh();
});

if (window.electronAPI) {
  window.electronAPI.onEditorSetText((payload) => {
    const content = typeof payload === 'string' ? payload : payload?.content || '';
    const title = typeof payload === 'object' && payload ? payload.title : '';
    const hasPath = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'path');
    const hasKind = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'kind');
    const hasProjectId = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'projectId');
    const hasBookProfile = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'bookProfile');
    const path = hasPath ? payload.path : '';
    const kind = hasKind ? payload.kind : '';
    const projectId = hasProjectId && typeof payload.projectId === 'string' ? payload.projectId : '';
    const bookProfile = hasBookProfile ? payload.bookProfile : null;
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
        adoptToolbarConfiguratorState(currentProjectId);
      }
    }
    if (hasBookProfile) {
      applyIncomingBookProfile(bookProfile);
    } else {
      applyIncomingBookProfile(null);
    }

    const parsed = parseDocumentContent(content);
    currentMeta = parsed.meta;
    currentCards = parsed.cards;
    plainTextBuffer = parsed.text || '';
    if (isTiptapMode) {
      setTiptapDocumentSnapshot({
        doc: parsed.doc,
        text: parsed.text || '',
      });
    } else {
      setPlainText(parsed.text || '');
    }
    if (parsed.issue) {
      handleDocumentContentParseIssue(parsed.issue);
    }
    updateMetaInputs();
    updateMetaVisibility();
    updateCardsList();

    localDirty = false;
    updateWordCount();

    const resolvedTitle = title || getTitleFromPath(path);
    if (resolvedTitle) {
      showEditorPanelFor(resolvedTitle);
    }
    renderTree();
    updateSaveStateText('loaded');
    updatePerfHintText('normal');
    updateInspectorSnapshot();
  });

  window.electronAPI.onEditorTextRequest(({ requestId }) => {
    window.electronAPI.sendEditorTextResponse(requestId, composeDocumentContent());
  });

  if (typeof window.electronAPI.onEditorSnapshotRequest === 'function') {
    window.electronAPI.onEditorSnapshotRequest(({ requestId }) => {
      window.electronAPI.sendEditorSnapshotResponse(requestId, composeEditorSnapshot());
    });
  }

  window.electronAPI.onEditorSetFontSize(({ px }) => {
    if (Number.isFinite(px)) {
      editor.style.fontSize = `${px}px`;
      setCurrentFontSize(px);
      renderStyledView(getPlainText());
    }
  });

  if (typeof window.electronAPI.onRecoveryRestored === 'function') {
    window.electronAPI.onRecoveryRestored((payload) => {
      const message = payload && typeof payload.message === 'string'
        ? payload.message
        : 'Recovered from autosave';
      updateWarningStateText('recovery restored');
      if (recoveryMessage) {
        recoveryMessage.textContent = message;
      }
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
      togglePreview: () => handleToggleLayoutPreview(),
      togglePreviewFrame: () => handleToggleLayoutPreviewFrame(),
      formatAlignLeft: () => {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT);
      },
      formatToggleBold: () => {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_BOLD);
      },
      formatToggleItalic: () => {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_ITALIC);
      },
      formatTextColorPicker: (_commandId, payload = {}) => handleFormatTextColorPicker(payload),
      formatHighlightColorPicker: (_commandId, payload = {}) => handleFormatHighlightColorPicker(payload),
      insertLinkPrompt: (_commandId, payload = {}) => handleInsertLinkPrompt(payload),
      listToggleBullet: () => {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.LIST_TOGGLE_BULLET);
      },
      listToggleOrdered: () => {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.LIST_TOGGLE_ORDERED);
      },
      listClear: () => {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.LIST_CLEAR);
      },
      reviewOpenComments: () => handleReviewOpenComments(),
      switchMode: (mode) => applyMode(mode),
    });
  } else if (typeof window.electronAPI.onRuntimeCommand === 'function') {
    window.electronAPI.onRuntimeCommand((payload) => {
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
      } else if (command === 'switch-preview-format-a4') {
        void dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.A4);
      } else if (command === 'switch-preview-format-a5') {
        void dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.A5);
      } else if (command === 'switch-preview-format-letter') {
        void dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.LETTER);
      } else if (command === 'toggle-preview') {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW);
      } else if (command === 'toggle-preview-frame') {
        void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW_FRAME);
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
      updateWarningStateText('recovery');
    } else if (normalized.includes('ошибка') || normalized.includes('error')) {
      updateWarningStateText('error');
    } else {
      updateWarningStateText('none');
    }
    updatePerfHintText('normal');
    updateInspectorSnapshot();
  });

  window.electronAPI.onSetDirty((state) => {
    localDirty = state;
    updateSaveStateText(localDirty ? 'unsaved' : 'saved');
    updateInspectorSnapshot();
  });
}

setCurrentFontSize(currentFontSizePx);
updateWordCount();
