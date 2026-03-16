import { initTiptap } from './tiptap/index.js';
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
import uiErrorMapDoc from '../../docs/OPS/STATUS/UI_ERROR_MAP.json';

if (window.__USE_TIPTAP) {
  initTiptap(document.getElementById('editor'));
} else {
const editor = document.getElementById('editor');
const statusElement = document.getElementById('status');
const saveStateElement = document.querySelector('[data-save-state]');
const warningStateElement = document.querySelector('[data-warning-state]');
const perfHintElement = document.querySelector('[data-perf-hint]');
const emptyState = document.querySelector('.empty-state');
const editorPanel = document.querySelector('.editor-panel');
const sidebar = document.querySelector('.sidebar');
const sidebarResizer = document.querySelector('[data-sidebar-resizer]');
const mainContent = document.querySelector('.main-content');
const toolbar = document.querySelector('[data-toolbar]');
const toolbarShell = document.querySelector('[data-toolbar-shell]');
const leftToolbar = document.querySelector('[data-left-toolbar]');
const leftToolbarShell = document.querySelector('[data-left-toolbar-shell]');
const topWorkBar = document.querySelector('[data-top-work-bar]');
const configuratorPanel = document.querySelector('[data-configurator-panel]');
const gridTriggerButton = document.querySelector('[data-grid-button]');
const configuratorSlotButtons = Array.from(document.querySelectorAll('.configurator-panel__slot'));
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
const fontDisplay = document.querySelector('[data-font-display]');
const weightDisplay = document.querySelector('[data-weight-display]');
const sizeDisplay = document.querySelector('[data-size-display]');
const lineHeightDisplay = document.querySelector('[data-line-height-display]');
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
let lastSearchQuery = '';
let plainTextBuffer = '';
const activeTab = 'roman';
let currentDocumentPath = null;
let currentDocumentKind = null;
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
let configuratorBucketState = {
  master: [],
  minimal: [],
};
let activeConfiguratorDragPayload = null;
let configuratorBucketPointerDragState = {
  active: false,
  draggedItem: null,
  sourceBucketKey: '',
  sourceIndex: -1,
  startX: 0,
  startY: 0,
  moved: false,
};
let activeConfiguratorBucketSelection = {
  bucketKey: '',
  itemIndex: -1,
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
    const toolbarHeight = Number(parsed.toolbarHeight);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      x,
      y,
      isVertical: Boolean(parsed.isVertical),
      isDetached: Boolean(parsed.isDetached),
      scale: Number.isFinite(scale) ? scale : 1,
      widthScale: Number.isFinite(widthScale) ? widthScale : 1,
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
    const offset = Number(toolbarItemOffsets[key] || 0);
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
    toolbarHeight: Number.isFinite(topBarRect?.height) ? topBarRect.height : 0,
  };
}

function applyFloatingToolbarVisualState() {
  if (!toolbarShell) return;
  toolbarShell.style.setProperty('--floating-toolbar-scale', String(floatingToolbarState.scale));
  toolbarShell.style.setProperty('--floating-toolbar-width-scale', String(floatingToolbarState.widthScale));
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
  floatingToolbarState = {
    x: nextPosition.x,
    y: nextPosition.y,
    isVertical: Boolean(partialState.isVertical),
    isDetached: Boolean(partialState.isDetached),
    scale: Math.min(Math.max(partialState.scale, FLOATING_TOOLBAR_SCALE_MIN), FLOATING_TOOLBAR_SCALE_MAX),
    widthScale: Math.min(
      Math.max(partialState.widthScale, FLOATING_TOOLBAR_WIDTH_SCALE_MIN),
      FLOATING_TOOLBAR_WIDTH_SCALE_MAX
    ),
    toolbarHeight: Number.isFinite(partialState.toolbarHeight) ? partialState.toolbarHeight : 0,
  };
  toolbar.style.left = `${Math.round(floatingToolbarState.x)}px`;
  toolbar.style.top = `${Math.round(floatingToolbarState.y)}px`;
  toolbar.style.transform = 'none';
  if (persist) {
    persistFloatingToolbarState();
  }
  applyFloatingToolbarVisualState();
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

function applyConfiguratorSelection(nextIndex) {
  if (!configuratorSlotButtons.length) return;
  configuratorSlotButtons.forEach((button, index) => {
    const active = index === nextIndex;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
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
      master: Array.isArray(parsed.master) ? parsed.master.filter((item) => typeof item === 'string' && item.trim()) : [],
      minimal: Array.isArray(parsed.minimal) ? parsed.minimal.filter((item) => typeof item === 'string' && item.trim()) : [],
    };
  } catch {
    return { master: [], minimal: [] };
  }
}

function persistConfiguratorBucketState() {
  try {
    localStorage.setItem(CONFIGURATOR_BUCKETS_STORAGE_KEY, JSON.stringify(configuratorBucketState));
  } catch {}
}

function writeConfiguratorDragPayload(event, payload) {
  if (!event.dataTransfer) return false;
  try {
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
  } catch {}
  event.dataTransfer.setData('text/plain', payload.label || '');
  return true;
}

function readConfiguratorDragPayload(event) {
  if (activeConfiguratorDragPayload) {
    return activeConfiguratorDragPayload;
  }
  const raw = event.dataTransfer?.getData('application/json') || '';
  if (!raw) {
    const label = event.dataTransfer?.getData('text/plain')?.trim() || '';
    return label ? { sourceType: 'slot', label } : null;
  }
  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}

function setActiveConfiguratorBucketSelection(bucketKey = '', itemIndex = -1) {
  activeConfiguratorBucketSelection = {
    bucketKey,
    itemIndex: Number.isInteger(itemIndex) ? itemIndex : -1,
  };
  configuratorBuckets.forEach((bucket) => {
    bucket.querySelectorAll('.configurator-panel__bucket-item').forEach((item) => {
      const itemBucketKey = item.dataset.bucketKey || '';
      const currentIndex = Number.parseInt(item.dataset.bucketIndex || '', 10);
      const isActive = itemBucketKey === bucketKey && currentIndex === activeConfiguratorBucketSelection.itemIndex;
      item.classList.toggle('is-active', isActive);
    });
  });
}

function createConfiguratorBucketItem(label, bucketKey, index) {
  const item = document.createElement('div');
  item.className = 'configurator-panel__bucket-item';
  item.draggable = false;
  item.dataset.bucketKey = bucketKey;
  item.dataset.bucketIndex = String(index);
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-label', `${label}. Перетащите для перестановки или используйте крестик для удаления.`);

  const icon = document.createElement('span');
  icon.className = 'configurator-panel__slot-icon';
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'configurator-panel__slot-text';
  text.textContent = label;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'configurator-panel__bucket-remove';
  removeButton.setAttribute('aria-label', `Удалить ${label}`);
  removeButton.textContent = '×';

  item.append(icon, text, removeButton);
  item.addEventListener('mousedown', (event) => {
    const removeTarget = event.target instanceof Element
      ? event.target.closest('.configurator-panel__bucket-remove')
      : null;
    if (removeTarget) return;
    if (event.button !== 0) return;
    event.preventDefault();
    const itemIndex = Number.parseInt(item.dataset.bucketIndex || '', 10);
    if (!Number.isInteger(itemIndex)) return;
    stopConfiguratorBucketPointerDrag();
    configuratorBucketPointerDragState = {
      active: true,
      draggedItem: item,
      sourceBucketKey: bucketKey,
      sourceIndex: itemIndex,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  });
  removeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const itemIndex = Number.parseInt(item.dataset.bucketIndex || '', 10);
    if (activeConfiguratorBucketSelection.bucketKey === bucketKey && activeConfiguratorBucketSelection.itemIndex === itemIndex) {
      setActiveConfiguratorBucketSelection('', -1);
    }
    removeConfiguratorBucketItem(bucketKey, itemIndex);
  });
  if (activeConfiguratorBucketSelection.bucketKey === bucketKey && activeConfiguratorBucketSelection.itemIndex === index) {
    item.classList.add('is-active');
  }
  return item;
}

function renderConfiguratorBuckets() {
  configuratorBuckets.forEach((bucket) => {
    const bucketKey = bucket.dataset.configuratorBucket;
    if (!bucketKey) return;
    bucket.replaceChildren();
    const items = configuratorBucketState[bucketKey] || [];
    items.forEach((label, index) => {
      bucket.appendChild(createConfiguratorBucketItem(label, bucketKey, index));
    });
  });
}

function addConfiguratorBucketItem(bucketKey, label, insertIndex = null) {
  if (!bucketKey || typeof label !== 'string' || !label.trim()) return;
  if (!Array.isArray(configuratorBucketState[bucketKey])) {
    configuratorBucketState[bucketKey] = [];
  }
  const items = configuratorBucketState[bucketKey];
  const normalizedLabel = label.trim();
  const nextIndex = Number.isInteger(insertIndex) ? Math.max(0, Math.min(insertIndex, items.length)) : items.length;
  items.splice(nextIndex, 0, normalizedLabel);
  persistConfiguratorBucketState();
  renderConfiguratorBuckets();
}

function removeConfiguratorBucketItem(bucketKey, itemIndex) {
  if (!bucketKey || !Array.isArray(configuratorBucketState[bucketKey])) return;
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= configuratorBucketState[bucketKey].length) return;
  configuratorBucketState[bucketKey].splice(itemIndex, 1);
  if (activeConfiguratorBucketSelection.bucketKey === bucketKey && activeConfiguratorBucketSelection.itemIndex === itemIndex) {
    activeConfiguratorBucketSelection = { bucketKey: '', itemIndex: -1 };
  }
  persistConfiguratorBucketState();
  renderConfiguratorBuckets();
}

function moveConfiguratorBucketItem(fromBucketKey, fromIndex, toBucketKey, toIndex) {
  if (
    !fromBucketKey ||
    !toBucketKey ||
    !Array.isArray(configuratorBucketState[fromBucketKey]) ||
    !Array.isArray(configuratorBucketState[toBucketKey]) ||
    !Number.isInteger(fromIndex) ||
    fromIndex < 0 ||
    fromIndex >= configuratorBucketState[fromBucketKey].length
  ) {
    return;
  }

  const [label] = configuratorBucketState[fromBucketKey].splice(fromIndex, 1);
  if (!label) {
    renderConfiguratorBuckets();
    return;
  }

  let normalizedTargetIndex = Number.isInteger(toIndex)
    ? toIndex
    : configuratorBucketState[toBucketKey].length;

  if (fromBucketKey === toBucketKey && fromIndex < normalizedTargetIndex) {
    normalizedTargetIndex -= 1;
  }

  normalizedTargetIndex = Math.max(0, Math.min(normalizedTargetIndex, configuratorBucketState[toBucketKey].length));

  configuratorBucketState[toBucketKey].splice(normalizedTargetIndex, 0, label);
  activeConfiguratorBucketSelection = {
    bucketKey: toBucketKey,
    itemIndex: normalizedTargetIndex,
  };
  persistConfiguratorBucketState();
  renderConfiguratorBuckets();
}

function getConfiguratorBucketDropIndex(bucket, event) {
  const items = Array.from(bucket.querySelectorAll('.configurator-panel__bucket-item'));
  const targetItem = event.target instanceof Element
    ? event.target.closest('.configurator-panel__bucket-item')
    : null;
  if (!targetItem) {
    return items.length;
  }

  const fallbackIndex = items.indexOf(targetItem);
  const targetIndex = Number.parseInt(targetItem.dataset.bucketIndex || '', 10);
  const resolvedIndex = Number.isInteger(targetIndex) ? targetIndex : fallbackIndex;
  const rect = targetItem.getBoundingClientRect();
  const insertAfter = event.clientX > rect.left + rect.width / 2;
  return Math.max(0, resolvedIndex + (insertAfter ? 1 : 0));
}

function applyConfiguratorBucketDrop(bucketKey, payload, dropIndex) {
  if (!payload || !bucketKey) return;
  if (payload.sourceType === 'bucket-item') {
    moveConfiguratorBucketItem(
      payload.bucketKey || '',
      Number.parseInt(String(payload.itemIndex), 10),
      bucketKey,
      dropIndex
    );
    activeConfiguratorDragPayload = null;
    return;
  }
  addConfiguratorBucketItem(bucketKey, payload.label || '', dropIndex);
  activeConfiguratorDragPayload = null;
}

function clearConfiguratorBucketDropTarget() {
  configuratorBuckets.forEach((bucket) => bucket.classList.remove('is-drop-target'));
}

function getConfiguratorBucketDropTargetFromPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  if (!(target instanceof Element)) return null;
  const bucket = target.closest('[data-configurator-bucket]');
  if (!(bucket instanceof HTMLElement)) return null;
  const bucketKey = bucket.dataset.configuratorBucket || '';
  if (!bucketKey) return null;
  const item = target.closest('.configurator-panel__bucket-item');
  if (!(item instanceof HTMLElement)) {
    return {
      bucket,
      bucketKey,
      dropIndex: Array.isArray(configuratorBucketState[bucketKey]) ? configuratorBucketState[bucketKey].length : 0,
    };
  }
  const itemIndex = Number.parseInt(item.dataset.bucketIndex || '', 10);
  const rect = item.getBoundingClientRect();
  const insertAfter = clientX > rect.left + rect.width / 2;
  return {
    bucket,
    bucketKey,
    dropIndex: Math.max(0, itemIndex + (insertAfter ? 1 : 0)),
  };
}

function stopConfiguratorBucketPointerDrag() {
  const draggedItem = configuratorBucketPointerDragState.draggedItem;
  if (draggedItem instanceof HTMLElement) {
    draggedItem.classList.remove('is-dragging');
    draggedItem.style.removeProperty('pointer-events');
  }
  configuratorBucketPointerDragState = {
    active: false,
    draggedItem: null,
    sourceBucketKey: '',
    sourceIndex: -1,
    startX: 0,
    startY: 0,
    moved: false,
  };
  clearConfiguratorBucketDropTarget();
}

function handleConfiguratorBucketPointerMove(event) {
  if (!configuratorBucketPointerDragState.active) return;
  if (!configuratorBucketPointerDragState.moved) {
    const deltaX = event.clientX - configuratorBucketPointerDragState.startX;
    const deltaY = event.clientY - configuratorBucketPointerDragState.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < FLOATING_TOOLBAR_DRAG_THRESHOLD_PX) {
      return;
    }
    configuratorBucketPointerDragState.moved = true;
    if (configuratorBucketPointerDragState.draggedItem instanceof HTMLElement) {
      configuratorBucketPointerDragState.draggedItem.classList.add('is-dragging');
      configuratorBucketPointerDragState.draggedItem.style.pointerEvents = 'none';
    }
  }
  const dropTarget = getConfiguratorBucketDropTargetFromPoint(event.clientX, event.clientY);
  clearConfiguratorBucketDropTarget();
  dropTarget?.bucket.classList.add('is-drop-target');
}

function handleConfiguratorBucketPointerUp(event) {
  if (!configuratorBucketPointerDragState.active) return;
  const {
    sourceBucketKey,
    sourceIndex,
    moved,
  } = configuratorBucketPointerDragState;
  const dropTarget = getConfiguratorBucketDropTargetFromPoint(event.clientX, event.clientY);
  stopConfiguratorBucketPointerDrag();
  if (!moved) {
    if (activeConfiguratorBucketSelection.bucketKey === sourceBucketKey && activeConfiguratorBucketSelection.itemIndex === sourceIndex) {
      setActiveConfiguratorBucketSelection('', -1);
    } else {
      setActiveConfiguratorBucketSelection(sourceBucketKey, sourceIndex);
    }
    return;
  }
  if (!dropTarget) return;
  moveConfiguratorBucketItem(sourceBucketKey, sourceIndex, dropTarget.bucketKey, dropTarget.dropIndex);
}

function initializeConfiguratorBuckets() {
  if (!configuratorBuckets.length || !configuratorSlotButtons.length) return;

  configuratorBucketState = readConfiguratorBucketState();
  renderConfiguratorBuckets();
  window.addEventListener('mousemove', handleConfiguratorBucketPointerMove);
  window.addEventListener('mouseup', handleConfiguratorBucketPointerUp);
  document.addEventListener('mousedown', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.configurator-panel__bucket-item')) return;
    if (activeConfiguratorBucketSelection.bucketKey || activeConfiguratorBucketSelection.itemIndex !== -1) {
      setActiveConfiguratorBucketSelection('', -1);
    }
  });

  configuratorSlotButtons.forEach((button) => {
    button.draggable = true;
    button.addEventListener('dragstart', (event) => {
      const text = button.querySelector('.configurator-panel__slot-text')?.textContent?.trim() || '';
      if (!text || !event.dataTransfer) return;
      activeConfiguratorDragPayload = { sourceType: 'slot', label: text };
      writeConfiguratorDragPayload(event, activeConfiguratorDragPayload);
      event.dataTransfer.effectAllowed = 'copy';
    });
    button.addEventListener('dragend', () => {
      activeConfiguratorDragPayload = null;
      configuratorBuckets.forEach((bucketElement) => bucketElement.classList.remove('is-drop-target'));
    });
  });

  configuratorBuckets.forEach((bucket) => {
    bucket.addEventListener('dragover', (event) => {
      event.preventDefault();
      const payload = readConfiguratorDragPayload(event);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = payload?.sourceType === 'bucket-item' ? 'move' : 'copy';
      }
      bucket.classList.add('is-drop-target');
    });
    bucket.addEventListener('dragleave', () => {
      bucket.classList.remove('is-drop-target');
    });
    bucket.addEventListener('drop', (event) => {
      event.preventDefault();
      bucket.classList.remove('is-drop-target');
      const bucketKey = bucket.dataset.configuratorBucket || '';
      const payload = readConfiguratorDragPayload(event);
      if (!payload || !bucketKey) return;
      const dropIndex = getConfiguratorBucketDropIndex(bucket, event);
      applyConfiguratorBucketDrop(bucketKey, payload, dropIndex);
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

function initializeFloatingToolbarDragFoundation() {
  if (!toolbarShell) return;
  toolbarShell.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
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
      applyFloatingToolbarState({
        ...origin,
        widthScale: origin.widthScale + widthDelta,
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
  },
});
const commandPaletteDataProvider = createPaletteDataProvider(commandRegistry, { defaultSurface: 'palette' });
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
  return plainTextBuffer;
}

let deferredRenderTimerId = null;
let deferredPaginationTimerId = null;
let deferredRenderIncludePagination = false;
let deferredRenderPreserveSelection = true;
let incrementalInputDomSyncScheduled = false;
let lastFullRenderAtMs = 0;

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
  if (!editor) return;
  editor.innerHTML = '';
  const page = createPageElement(true, 0);
  editor.appendChild(page);
}

function paginateNodes(nodes) {
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
  plainTextBuffer = (editor.textContent || '').replace(/\u00a0/g, ' ');
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

function showEditorPanelFor(title) {
  editorPanel?.classList.add('active');
  mainContent?.classList.add('main-content--editor');
  emptyState?.classList.add('hidden');
  updateMetaVisibility();
  try {
    if (title) {
      localStorage.setItem('activeDocumentTitle', title);
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
    stored = JSON.parse(localStorage.getItem(`treeExpanded:${tab}`) || '[]');
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
    localStorage.setItem(`treeExpanded:${tab}`, JSON.stringify(Array.from(set)));
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
      try {
        stored = localStorage.getItem('treeExpanded:roman');
      } catch {}
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

if (sidebar && sidebarResizer) {
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;
  let dragStartX = null;
  let dragStartWidth = null;

  function onMove(event) {
    if (dragStartX === null || dragStartWidth === null) return;
    const delta = event.clientX - dragStartX;
    const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth + delta));
    sidebar.style.width = `${nextWidth}px`;
  }

  function stop() {
    dragStartX = null;
    dragStartWidth = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
    scheduleLayoutRefresh();
  }

  sidebarResizer.addEventListener('pointerdown', (event) => {
    dragStartX = event.clientX;
    dragStartWidth = sidebar.getBoundingClientRect().width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
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

configuratorPanel?.addEventListener('click', (event) => {
  const button = event.target.closest('.configurator-panel__slot');
  if (!button) return;
  const nextIndex = configuratorSlotButtons.indexOf(button);
  if (nextIndex === -1) return;
  applyConfiguratorSelection(nextIndex);
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
  updateInspectorSnapshot();
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
    const isActive = activeAction !== 'align-left' && button.dataset.action === activeAction;
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
  editor.focus();
  document.execCommand('undo');
  return { performed: true };
}

function handleRedo() {
  if (!editor) return { performed: false };
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
metaPanel?.classList.add('is-hidden');
if (rightSceneMetaPanel && metaPanel) {
  rightSceneMetaPanel.appendChild(metaPanel);
}
updateSaveStateText('idle');
updateWarningStateText('none');
updatePerfHintText('normal');
updateInspectorSnapshot();
applyMode('write');
applyLeftTab('project');
applyRightTab('inspector');
installNetworkGuard();
void initializeCollabScopeLocal();
if (configuratorSlotButtons.length) {
  const defaultSelectedIndex = configuratorSlotButtons.findIndex((button) => button.classList.contains('is-selected'));
  applyConfiguratorSelection(defaultSelectedIndex >= 0 ? defaultSelectedIndex : 0);
}
initializeConfiguratorBuckets();
showEditorPanelFor('Yalken');
updateWordCount();
initializeFloatingToolbarSpacingMenu();
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
});
document.addEventListener('selectionchange', syncAlignmentButtonsToSelection);

window.addEventListener('resize', scheduleLayoutRefresh);

if (window.electronAPI) {
  window.electronAPI.onEditorSetText((payload) => {
    const content = typeof payload === 'string' ? payload : payload?.content || '';
    const title = typeof payload === 'object' && payload ? payload.title : '';
    const hasPath = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'path');
    const hasKind = typeof payload === 'object' && payload && Object.prototype.hasOwnProperty.call(payload, 'kind');
    const path = hasPath ? payload.path : '';
    const kind = hasKind ? payload.kind : '';
    const nextMetaEnabled = typeof payload === 'object' && payload ? Boolean(payload.metaEnabled) : false;

    clearFlowModeState();
    metaEnabled = nextMetaEnabled;
    if (hasPath) {
      currentDocumentPath = path || null;
    }
    if (hasKind) {
      currentDocumentKind = kind || null;
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
    renderTree();
    updateSaveStateText('loaded');
    updatePerfHintText('normal');
    updateInspectorSnapshot();
  });

  window.electronAPI.onEditorTextRequest(({ requestId }) => {
    window.electronAPI.sendEditorTextResponse(requestId, composeDocumentContent());
  });

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
      openRecoveryModal(message);
      updateInspectorSnapshot();
    });
  }

  if (typeof window.electronAPI.onRuntimeCommand === 'function') {
    window.electronAPI.onRuntimeCommand((payload) => {
      const command = payload && typeof payload.command === 'string' ? payload.command : '';
      if (command === 'open-settings') {
        openSettingsModal();
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

editor.addEventListener('pointerdown', (event) => {
  const nextIndex = getPageIndexFromNode(event.target);
  lastPointerDownPageIndex = nextIndex != null ? nextIndex : -1;
});

editor.addEventListener('beforeinput', () => {
  ensureCaretInLastPointerPage();
});

editor.addEventListener('input', () => {
  scheduleIncrementalInputDomSync();
  syncPlainTextBufferFromEditorDom();
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

}
