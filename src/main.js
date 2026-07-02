const { app, BrowserWindow, Menu, dialog, ipcMain, session } = require('electron');
const { performance } = require('perf_hooks');
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const { pathToFileURL, fileURLToPath } = require('url');
const fileManager = require('./utils/fileManager');
const backupManager = require('./utils/backupManager');
const { hasDirectoryContent, copyDirectoryContents } = require('./utils/fsHelpers');
const {
  readFlowSceneBatchMarkers,
  writeFlowSceneBatchAtomic,
} = require('./utils/flowSceneBatchAtomic');
const {
  applyMarkdownImportSafeCreate,
} = require('./utils/markdownImportSafeCreate');
const {
  applyDocxImportSafeCreate,
  isDocxImportPreviewPlanAdmitted,
  rememberDocxImportPreviewPlanAdmission,
} = require('./utils/docxImportSafeCreate');
const {
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
  createDocxImportLocalFilePreview,
} = require('./utils/docxImportLocalFilePreview');
const {
  isPathInsideBoundary,
  joinPathSegmentsWithinRoot,
  resolveValidatedPath,
  sanitizePathFields,
  sanitizePathFieldsWithinRoot,
} = require('./core/io/path-boundary');
const { buildDocxMinBuffer: buildDocxMinBufferCore } = require('./export/docx/docxMinBuilder');
const { runDocxMinExport } = require('./export/docx/docxMinExportHandler');
const { writeBufferAtomic } = require('./export/docx/atomicWriteBuffer');
const { createCommandSurfaceKernel } = require('./command/commandSurfaceKernel');

const launchT0 = performance.now();
let mainWindow;
let currentFilePath = null; // Путь к текущему открытому файлу
let currentReviewSurfacePayload = {};
let currentReviewSurfacePayloadSource = 'none';
let currentReviewSurfacePayloadContentHash = '';
let activeReviewSessionStore = null;
let activeReviewSessionLifecycle = 'passive';
let isDirty = false;
let isEditorPasteTargetFocused = false;
let autoSaveInProgress = false;
let isQuitting = false;
let isWindowClosing = false;
let lastAutosaveHash = null;
const backupHashes = new Map();
const isDevMode = process.argv.includes('--dev');
const CSP_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const FILE_NAVIGATION_FAIL_CODE = 'E_PATH_BOUNDARY_VIOLATION';
const FILE_NAVIGATION_FAIL_SIGNAL = 'E_RUNTIME_WIRING_BEFORE_STAGE';
const CORRESPONDING_SOURCE_BASE_URL = 'https://github.com/KirPon2024/writer-editor';
const ABOUT_LICENSE_TEXT_FALLBACK = 'Yalken is licensed under AGPL-3.0-or-later.';
const EDITOR_PASTE_FOCUS_STATE_CHANNEL = 'editor:paste-focus-state';
const singleInstanceLockAcquired = typeof app.requestSingleInstanceLock === 'function'
  ? app.requestSingleInstanceLock()
  : true;

function focusExistingMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (typeof mainWindow.isMinimized === 'function' && mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (typeof mainWindow.isVisible === 'function' && !mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  return true;
}

if (!singleInstanceLockAcquired) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusExistingMainWindow();
  });
}

function normalizeEditorPasteFocusState(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (typeof payload.focused !== 'boolean') return null;
  return payload.focused;
}

function isPrimaryPasteShortcut(input) {
  if (!input || input.type !== 'keyDown') return false;
  const key = typeof input.key === 'string' ? input.key.toLowerCase() : '';
  if (key !== 'v') return false;
  if (input.isAutoRepeat === true) return false;
  if (input.alt || input.shift) return false;

  const primaryPressed = process.platform === 'darwin' ? input.meta : input.control;
  const secondaryPressed = process.platform === 'darwin' ? input.control : input.meta;
  return Boolean(primaryPressed && !secondaryPressed);
}

function handlePrimaryPasteShortcut(event, input, win) {
  if (!isPrimaryPasteShortcut(input)) return false;
  if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) return false;
  if (typeof win.isFocused === 'function' && !win.isFocused()) return false;
  if (isEditorPasteTargetFocused !== true) return true;
  win.webContents.paste();
  return true;
}

function resolveRepoRootForAbout() {
  return path.resolve(__dirname, '..');
}

function resolveAboutLicenseTextPath() {
  return path.join(resolveRepoRootForAbout(), 'docs', 'OPERATIONS', 'ABOUT_LICENSE_TEXT.md');
}

function extractNoticeFromAboutLicenseText(raw) {
  const text = typeof raw === 'string' ? raw : '';
  const quoted = text.match(/"([^"]+)"/);
  if (quoted && quoted[1]) return quoted[1].trim();
  return ABOUT_LICENSE_TEXT_FALLBACK;
}

function resolveCorrespondingSourceRef() {
  const envRef = typeof process.env.CRAFTSMAN_CORRESPONDING_SOURCE_REF === 'string'
    ? process.env.CRAFTSMAN_CORRESPONDING_SOURCE_REF.trim()
    : '';
  if (envRef) return envRef;

  const repoRoot = resolveRepoRootForAbout();
  const gitDir = path.join(repoRoot, '.git');
  if (!fsSync.existsSync(gitDir)) return CORRESPONDING_SOURCE_BASE_URL;

  const probe = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (probe.status !== 0) return CORRESPONDING_SOURCE_BASE_URL;

  const sha = typeof probe.stdout === 'string' ? probe.stdout.trim() : '';
  if (!sha) return CORRESPONDING_SOURCE_BASE_URL;
  return `${CORRESPONDING_SOURCE_BASE_URL}/tree/${sha}`;
}

function buildAboutLicenseNotice() {
  try {
    const raw = fsSync.readFileSync(resolveAboutLicenseTextPath(), 'utf8');
    return extractNoticeFromAboutLicenseText(raw);
  } catch {
    return ABOUT_LICENSE_TEXT_FALLBACK;
  }
}

async function showAboutLicensesDialog() {
  const win = BrowserWindow.getFocusedWindow() || mainWindow || null;
  const notice = buildAboutLicenseNotice();
  const sourceRef = resolveCorrespondingSourceRef();
  const detail = `${notice}\n\nCorresponding Source:\n${sourceRef}`;

  await dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['OK'],
    defaultId: 0,
    title: 'О программе и лицензии',
    message: 'Yalken — AGPL-3.0-or-later',
    detail,
    noLink: true,
  });
}

function createAboutLicensesMenuEntry() {
  const artifactDoc = readMenuArtifactDocument(resolveRuntimeMenuArtifactPath());
  const localeCatalog = resolveRuntimeMenuLocaleCatalog(artifactDoc);
  const aboutLabel = resolveAboutLicensesMenuLabel();
  return {
    id: 'help',
    label: resolveLocalizedMenuLabel(localeCatalog, MENU_LOCALE_HELP_LABEL_KEY, 'Help'),
    submenu: [
      {
        id: 'help-about-licenses',
        label: aboutLabel,
        click: () => {
          showAboutLicensesDialog().catch((error) => {
            logDevError('showAboutLicensesDialog', error);
          });
        },
      },
    ],
  };
}

function ensureAboutLicensesMenuEntry(template) {
  const hasAboutEntry = template.some((item) =>
    item && (item.id === 'help-about-licenses'
      || (Array.isArray(item.submenu)
        && item.submenu.some((child) => child && child.id === 'help-about-licenses')))
  );
  if (hasAboutEntry) return;

  const helpMenu = template.find((item) => item && (item.id === 'help' || item.role === 'help'));
  if (helpMenu && Array.isArray(helpMenu.submenu)) {
    helpMenu.submenu.push(createAboutLicensesMenuEntry().submenu[0]);
    return;
  }

  template.push(createAboutLicensesMenuEntry());
}

function logPerfStage(label) {
  if (!isDevMode) return;
  const elapsed = Math.round(performance.now() - launchT0);
  console.info(`[perf] ${label}: ${elapsed}ms`);
}
let diskQueue = Promise.resolve();
const pendingTextRequests = new Map();
const pendingSnapshotRequests = new Map();
let currentFontSize = 16;
const MENU_PRESENTATION_MODE_CLASSIC = 'classic';
const MENU_PRESENTATION_MODE_COMPACT = 'compact';
const MENU_PRESENTATION_MODE_SETTING_KEY = 'menuPresentationMode';
const MENU_PRESENTATION_COMPACT_ROOT_ID = 'compact-root';
const MENU_PRESENTATION_COMMAND_CLASSIC = 'cmd.project.view.setMenuPresentationClassic';
const MENU_PRESENTATION_COMMAND_COMPACT = 'cmd.project.view.setMenuPresentationCompact';
const MENU_LOCALE_MODE_BASE = 'base';
const MENU_LOCALE_MODE_RU = 'ru';
const MENU_LOCALE_MODE_EN = 'en';
const MENU_LOCALE_SETTING_KEY = 'menuLocale';
const MENU_LOCALE_COMMAND_BASE = 'cmd.project.view.setMenuLocaleBase';
const MENU_LOCALE_COMMAND_RU = 'cmd.project.view.setMenuLocaleRu';
const MENU_LOCALE_COMMAND_EN = 'cmd.project.view.setMenuLocaleEn';
const MENU_LOCALE_HELP_LABEL_KEY = 'menu.help';
const MENU_LOCALE_ABOUT_LICENSES_LABEL_KEY = 'menu.help.aboutLicenses';
const MENU_CUSTOMIZATION_SCHEMA_VERSION = 1;
const MENU_CUSTOMIZATION_SETTING_KEY = 'menuCustomization';
const MENU_CUSTOMIZATION_FIXED_PREFIX_IDS = Object.freeze(['file', 'edit', 'view']);
const MENU_CUSTOMIZATION_FIXED_PREFIX_ID_SET = new Set(MENU_CUSTOMIZATION_FIXED_PREFIX_IDS);
const MENU_CUSTOMIZATION_FIXED_TAIL_ID = 'help';
const MENU_CUSTOMIZATION_SUBMENU_FROM_VISIBILITY_SECTIONS = 'menuCustomizationVisibilitySections';
const MENU_CUSTOMIZATION_SUBMENU_FROM_ORDER_SECTIONS = 'menuCustomizationOrderSections';
const MENU_CUSTOMIZATION_COMMAND_RESET = 'cmd.project.view.resetMenuCustomization';
const MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY = 'cmd.project.view.toggleMenuSectionVisibility';
const MENU_CUSTOMIZATION_COMMAND_MOVE_EARLIER = 'cmd.project.view.moveMenuSectionEarlier';
const MENU_CUSTOMIZATION_COMMAND_MOVE_LATER = 'cmd.project.view.moveMenuSectionLater';
const MENU_CUSTOMIZATION_MOVE_EARLIER_LABEL_KEY = 'menu.view.customization.moveEarlier';
const MENU_CUSTOMIZATION_MOVE_LATER_LABEL_KEY = 'menu.view.customization.moveLater';
const MENU_LOCAL_CUSTOMIZATION_COMMAND_IDS = new Set([
  MENU_CUSTOMIZATION_COMMAND_RESET,
  MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY,
  MENU_CUSTOMIZATION_COMMAND_MOVE_EARLIER,
  MENU_CUSTOMIZATION_COMMAND_MOVE_LATER,
]);
let currentMenuPresentationMode = MENU_PRESENTATION_MODE_CLASSIC;
let currentMenuLocale = MENU_LOCALE_MODE_BASE;
let currentMenuCustomization = createDefaultMenuCustomization();
let currentMenuCustomizationSectionIds = [];
const USER_DATA_FOLDER_NAME = 'craftsman';
const LEGACY_USER_DATA_FOLDER_NAME = 'WriterEditor';
const MIGRATION_MARKER = '.migrated-from-writer-editor';
const DEFAULT_PROJECT_NAME = 'Роман';
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';
const PROJECT_MANIFEST_SCHEMA_VERSION = 1;
const PROJECT_SUBFOLDERS = {
  roman: 'roman',
  mindmap: 'mindmap',
  print: 'print',
  materials: 'materials',
  reference: 'reference',
  trash: 'trash',
  backups: 'backups'
};
const MATERIALS_SECTION_LABELS = ['Заметки', 'Исследования', 'Идеи/черновики', 'Вырезки'];
const REFERENCE_SECTION_LABELS = ['Персонажи', 'Локации', 'Термины/глоссарий', 'События/таймлайн'];
const ROMAN_SECTION_LABELS = [
  'обложка',
  'черновик',
  'карта идей',
  'чистовой текст',
  'поток сознания',
  'сны',
  'статистика'
];
const ROMAN_MIND_MAP_SECTION_LABELS = ['карта сюжета', 'карта идей'];
const PRINT_SECTION_LABELS = ['макет'];
const ROMAN_META_KINDS = new Set(['chapter-file', 'scene']);
const EXPORT_DOCX_MIN_CHANNEL = 'u:cmd:project:export:docxMin:v1';
const EXPORT_DOCX_DEFAULT_REQUEST_ID = 'u3-export-docxmin-request';
const IMPORT_MARKDOWN_V1_CHANNEL = 'm:cmd:project:import:markdownV1:v1';
const EXPORT_MARKDOWN_V1_CHANNEL = 'm:cmd:project:export:markdownV1:v1';
const FLOW_OPEN_V1_CHANNEL = 'm:cmd:project:flow:open:v1';
const FLOW_SAVE_V1_CHANNEL = 'm:cmd:project:flow:save:v1';
const MARKDOWN_RELIABILITY_LOG_PATH = path.join(os.tmpdir(), 'writer-editor-ops-state', 'markdown-io.log');
const MARKDOWN_IMPORT_PREVIEW_SCHEMA = 'markdown-import-preview.v1';
const MARKDOWN_IMPORT_PREVIEW_TYPE = 'markdown.import.preview';
const COMMAND_SURFACE_KERNEL_COMMAND_IDS = Object.freeze({
  PROJECT_OPEN: 'cmd.project.open',
  PROJECT_SAVE: 'cmd.project.save',
  PROJECT_SAVE_AS: 'cmd.project.saveAs',
  PROJECT_IMPORT_MARKDOWN_V1: 'cmd.project.importMarkdownV1',
  PROJECT_EXPORT_MARKDOWN_V1: 'cmd.project.exportMarkdownV1',
  PROJECT_RELEASE_CLAIM_ADMIT: 'cmd.project.releaseClaim.admit',
});
let internalCommandSurfaceKernel = null;

// CONTOUR_01A_REVIEW_MUTATE_PORT_START
function makeReviewMutateTypedError(commandId, code, reason, details = undefined) {
  const error = {
    code,
    op: commandId,
    reason,
  };
  if (isPlainObjectValue(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
}

function resetActiveReviewSessionStore(nextLifecycle = 'passive') {
  activeReviewSessionStore = null;
  activeReviewSessionLifecycle = nextLifecycle === 'cleared' ? 'cleared' : 'passive';
  currentReviewSurfacePayload = {};
  currentReviewSurfacePayloadSource = 'none';
  currentReviewSurfacePayloadContentHash = '';
}

function buildReviewSurfaceStructuralPreviewFromStage01(preview = {}) {
  const session = isPlainObjectValue(preview.shadowPreview?.session) ? preview.shadowPreview.session : {};
  const reviewGraph = isPlainObjectValue(session.reviewGraph) ? session.reviewGraph : {};
  const structuralChanges = Array.isArray(reviewGraph.structuralChanges)
    ? reviewGraph.structuralChanges
    : [];
  const patchItems = Array.isArray(preview.reviewPatchset?.items)
    ? preview.reviewPatchset.items
    : [];
  const patchItemsById = new Map();
  patchItems.forEach((item) => {
    if (!isPlainObjectValue(item)) return;
    const itemId = typeof item.itemId === 'string' ? item.itemId : '';
    if (itemId) patchItemsById.set(itemId, item);
  });

  const items = structuralChanges
    .filter((change) => isPlainObjectValue(change))
    .map((change, index) => {
      const structuralChangeId = typeof change.structuralChangeId === 'string' && change.structuralChangeId
        ? change.structuralChangeId
        : `structural-change-${index}`;
      const patchItem = patchItemsById.get(structuralChangeId) || {};
      const reason = typeof patchItem.reason === 'string' && patchItem.reason
        ? patchItem.reason
        : 'REVISION_BRIDGE_STAGE01_STRUCTURAL_MANUAL_ONLY';
      return {
        itemId: structuralChangeId,
        structuralChangeId,
        structuralKind: typeof change.kind === 'string' ? change.kind : '',
        summary: typeof change.summary === 'string' ? change.summary : 'Structural item requires manual review.',
        manualOnlyReason: reason,
        reasonCodes: [reason],
      };
    });

  const unsupportedObservations = Array.isArray(preview.reviewPatchset?.unsupportedObservations)
    ? preview.reviewPatchset.unsupportedObservations
      .filter((observation) => isPlainObjectValue(observation))
      .map((observation, index) => ({
        itemId: typeof observation.itemId === 'string' && observation.itemId
          ? observation.itemId
          : `unsupported-${index}`,
        structuralKind: typeof observation.itemKind === 'string' ? observation.itemKind : '',
        reason: typeof observation.reason === 'string' && observation.reason
          ? observation.reason
          : 'REVISION_BRIDGE_STAGE01_UNSUPPORTED_OBSERVATION',
      }))
    : [];

  return {
    ok: true,
    type: 'revisionBridge.structuralManualReviewPreview',
    status: 'preview',
    code: 'REVISION_BRIDGE_STAGE01_STRUCTURAL_PREVIEW_DERIVED',
    reason: 'REVISION_BRIDGE_STAGE01_STRUCTURAL_PREVIEW_DERIVED',
    reasons: [],
    previewOnly: true,
    canAutoApply: false,
    autoApplyCount: 0,
    autoApplyCandidates: [],
    items,
    unsupportedObservations,
    summary: {
      totalStructuralChanges: structuralChanges.length,
      manualOnlyCount: items.length,
      unsupportedCount: unsupportedObservations.length,
    },
  };
}

function buildReviewSurfaceFromStage01PreviewResult(previewResult = {}) {
  const preview = isPlainObjectValue(previewResult.preview) ? cloneJsonSafe(previewResult.preview) : {};
  const shadowPreview = isPlainObjectValue(preview.shadowPreview) ? cloneJsonSafe(preview.shadowPreview) : {};
  const revisionSession = isPlainObjectValue(shadowPreview.session) ? cloneJsonSafe(shadowPreview.session) : {};
  return {
    revisionSession,
    shadowPreview,
    blockedApplyPlan: isPlainObjectValue(preview.blockedApplyPlan)
      ? cloneJsonSafe(preview.blockedApplyPlan)
      : {},
    structuralManualReviewPreview: buildReviewSurfaceStructuralPreviewFromStage01(preview),
    stage01Preview: preview,
  };
}

function normalizeReviewSessionImportReadyValue(source, projectId, sessionId, baselineHash, reviewSurface, revisionSession, now) {
  const currentBaselineHash = typeof source.currentBaselineHash === 'string' && source.currentBaselineHash.trim()
    ? source.currentBaselineHash.trim()
    : '';
  const sourcePacketHash = typeof source.sourcePacketHash === 'string' && source.sourcePacketHash.trim()
    ? source.sourcePacketHash.trim()
    : computeHash(JSON.stringify({
      projectId,
      sessionId,
      baselineHash,
      currentBaselineHash,
      reviewSurface,
      revisionSession,
      reviewPacket: isPlainObjectValue(source.reviewPacket) ? source.reviewPacket : undefined,
      parsedSurface: isPlainObjectValue(source.parsedSurface) ? source.parsedSurface : undefined,
      sourceViewState: isPlainObjectValue(source.sourceViewState) ? source.sourceViewState : undefined,
    }));

  return {
    ok: true,
    value: {
      projectId,
      sessionId,
      baselineHash,
      ...(currentBaselineHash ? { currentBaselineHash } : {}),
      reviewSurface: cloneJsonSafe(reviewSurface) || {},
      revisionSession: isPlainObjectValue(revisionSession) ? cloneJsonSafe(revisionSession) || {} : {},
      sourcePacketHash,
      createdAt: typeof source.createdAt === 'string' && source.createdAt.trim()
        ? source.createdAt.trim()
        : String(now()),
    },
  };
}

async function buildReviewSessionImportRecordFromStage01(source, metadata, now, options = {}) {
  const loadBridge = typeof options.loadRevisionBridgeModule === 'function'
    ? options.loadRevisionBridgeModule
    : loadRevisionBridgeModule;
  let revisionBridge = null;
  try {
    revisionBridge = await loadBridge();
  } catch (error) {
    return {
      ok: false,
      code: 'E_REVIEW_SESSION_IMPORT_INVALID',
      reason: 'REVIEW_STAGE01_PREVIEW_BUILDER_UNAVAILABLE',
      details: {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    };
  }
  if (!revisionBridge || typeof revisionBridge.buildStage01FixedCorePreview !== 'function') {
    return {
      ok: false,
      code: 'E_REVIEW_SESSION_IMPORT_INVALID',
      reason: 'REVIEW_STAGE01_PREVIEW_BUILDER_UNAVAILABLE',
    };
  }

  const previewInput = {
    projectId: metadata.projectId,
    sessionId: metadata.sessionId,
    baselineHash: metadata.baselineHash,
  };
  if (typeof source.currentBaselineHash === 'string' && source.currentBaselineHash.trim()) {
    previewInput.currentBaselineHash = source.currentBaselineHash.trim();
  }
  if (isPlainObjectValue(source.sourceViewState)) {
    previewInput.sourceViewState = cloneJsonSafe(source.sourceViewState);
  }
  if (isPlainObjectValue(source.reviewPacket)) {
    previewInput.reviewPacket = cloneJsonSafe(source.reviewPacket);
  } else {
    previewInput.parsedSurface = cloneJsonSafe(source.parsedSurface);
  }

  let previewResult = null;
  try {
    previewResult = revisionBridge.buildStage01FixedCorePreview(previewInput);
  } catch (error) {
    return {
      ok: false,
      code: 'E_REVIEW_SESSION_IMPORT_INVALID',
      reason: 'REVIEW_STAGE01_PREVIEW_BUILD_FAILED',
      details: {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    };
  }

  if (!isPlainObjectValue(previewResult) || previewResult.ok !== true || !isPlainObjectValue(previewResult.preview)) {
    return {
      ok: false,
      code: 'E_REVIEW_SESSION_IMPORT_INVALID',
      reason: 'REVIEW_STAGE01_PREVIEW_DIAGNOSTICS',
      details: {
        stage01Reason: typeof previewResult?.reason === 'string' ? previewResult.reason : '',
        reasons: Array.isArray(previewResult?.reasons) ? cloneJsonSafe(previewResult.reasons) : [],
      },
    };
  }

  const reviewSurface = buildReviewSurfaceFromStage01PreviewResult(previewResult);
  return normalizeReviewSessionImportReadyValue(
    source,
    metadata.projectId,
    metadata.sessionId,
    metadata.baselineHash,
    reviewSurface,
    reviewSurface.revisionSession,
    now,
  );
}

function normalizeReviewSessionImportRecord(payload = {}, options = {}) {
  const source = isPlainObjectValue(payload) ? payload : {};
  const now = typeof options.now === 'function'
    ? options.now
    : () => new Date().toISOString();
  const projectId = typeof source.projectId === 'string' ? source.projectId.trim() : '';
  const sessionId = typeof source.sessionId === 'string' ? source.sessionId.trim() : '';
  const baselineHash = typeof source.baselineHash === 'string' ? source.baselineHash.trim() : '';
  const reviewSurface = isPlainObjectValue(source.reviewSurface)
    ? cloneJsonSafe(source.reviewSurface)
    : null;
  const revisionSession = isPlainObjectValue(source.revisionSession)
    ? cloneJsonSafe(source.revisionSession)
    : {};
  const hasStage01Input = isPlainObjectValue(source.reviewPacket) || isPlainObjectValue(source.parsedSurface);
  const hasReviewSurfaceInput = hasReviewSurfacePayload(reviewSurface);

  if (!hasReviewSurfaceInput && !hasStage01Input) {
    return {
      ok: false,
      code: 'E_REVIEW_SESSION_IMPORT_INVALID',
      reason: 'REVIEW_SURFACE_REQUIRED',
    };
  }

  if (!projectId || !sessionId || !baselineHash) {
    return {
      ok: false,
      code: 'E_REVIEW_SESSION_IMPORT_INVALID',
      reason: 'REVIEW_SESSION_METADATA_REQUIRED',
    };
  }

  if (hasReviewSurfaceInput) {
    return normalizeReviewSessionImportReadyValue(
      source,
      projectId,
      sessionId,
      baselineHash,
      reviewSurface,
      revisionSession,
      now,
    );
  }

  return buildReviewSessionImportRecordFromStage01(
    source,
    { projectId, sessionId, baselineHash },
    now,
    options,
  );
}

function cloneActiveReviewSessionStore() {
  if (!isPlainObjectValue(activeReviewSessionStore)) {
    return null;
  }
  return cloneJsonSafe(activeReviewSessionStore) || null;
}

function readActiveReviewSessionReviewSurface() {
  if (activeReviewSessionLifecycle !== 'active' || !isPlainObjectValue(activeReviewSessionStore)) {
    return {};
  }
  const reviewSurface = activeReviewSessionStore.reviewSurface;
  return hasReviewSurfacePayload(reviewSurface)
    ? cloneJsonSafe(reviewSurface) || {}
    : {};
}

function handleReviewSurfaceImportPacketCommandSurface(payload = {}) {
  return Promise.resolve(normalizeReviewSessionImportRecord(payload)).then((normalized) => {
    if (!normalized.ok) {
      return makeReviewMutateTypedError(
        'cmd.project.review.importPacket',
        normalized.code,
        normalized.reason,
        normalized.details,
      );
    }

    activeReviewSessionStore = cloneJsonSafe(normalized.value) || {};
    activeReviewSessionLifecycle = 'active';
    currentReviewSurfacePayload = cloneJsonSafe(normalized.value.reviewSurface) || {};
    currentReviewSurfacePayloadSource = 'session';
    currentReviewSurfacePayloadContentHash = '';

    return {
      ok: true,
      session: cloneActiveReviewSessionStore(),
      reviewSurface: readActiveReviewSessionReviewSurface(),
    };
  });
}

function handleReviewSurfaceClearSessionCommandSurface() {
  const hadActiveSession = activeReviewSessionLifecycle === 'active'
    && isPlainObjectValue(activeReviewSessionStore)
    && hasReviewSurfacePayload(activeReviewSessionStore.reviewSurface);
  resetActiveReviewSessionStore('cleared');
  return {
    ok: true,
    cleared: true,
    hadActiveSession,
  };
}

const REVIEW_EXACT_TEXT_APPLY_COMMAND_ID = 'cmd.project.review.applyExactTextChange';
const REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID = 'cmd.project.review.applyExactTextChangesBatch';
const REVIEW_EXACT_TEXT_APPLY_BATCH_MAX_CHANGE_IDS = 10;
const REVIEW_EXACT_TEXT_APPLY_ALLOWED_PAYLOAD_KEYS = Object.freeze([
  'requestId',
  'changeId',
]);
const REVIEW_EXACT_TEXT_APPLY_BATCH_ALLOWED_PAYLOAD_KEYS = Object.freeze([
  'requestId',
  'changeIds',
]);
const REVIEW_EXACT_TEXT_APPLY_FORBIDDEN_AUTHORITY_KEYS = Object.freeze([
  'applyOps',
  'contour03Plan',
  'inputHash',
  'outputHash',
  'plan',
  'planPreview',
  'projectRoot',
  'projectSnapshot',
  'receipt',
  'revisionSession',
  'reviewItem',
  'scenePath',
  'scenePathBySceneId',
]);

function normalizeReviewExactTextApplyPayload(payload = {}) {
  if (!isPlainObjectValue(payload)) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_PAYLOAD_INVALID',
      reason: 'REVIEW_EXACT_TEXT_APPLY_PAYLOAD_REQUIRED',
    };
  }

  const keys = Object.keys(payload);
  const forbiddenAuthorityKeys = keys
    .filter((key) => REVIEW_EXACT_TEXT_APPLY_FORBIDDEN_AUTHORITY_KEYS.includes(key))
    .sort();
  const unsupportedKeys = keys
    .filter((key) => !REVIEW_EXACT_TEXT_APPLY_ALLOWED_PAYLOAD_KEYS.includes(key))
    .sort();
  if (forbiddenAuthorityKeys.length > 0 || unsupportedKeys.length > 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_PAYLOAD_INVALID',
      reason: forbiddenAuthorityKeys.length > 0
        ? 'REVIEW_EXACT_TEXT_APPLY_RENDERER_AUTHORITY_DENIED'
        : 'REVIEW_EXACT_TEXT_APPLY_PAYLOAD_UNSUPPORTED_FIELDS',
      details: {
        fields: forbiddenAuthorityKeys.length > 0 ? forbiddenAuthorityKeys : unsupportedKeys,
      },
    };
  }

  const changeId = typeof payload.changeId === 'string' ? payload.changeId.trim() : '';
  const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
  return {
    ok: true,
    value: {
      ...(requestId ? { requestId } : {}),
      ...(changeId ? { changeId } : {}),
    },
  };
}

function normalizeReviewExactTextApplyBatchPayload(payload = {}) {
  if (!isPlainObjectValue(payload)) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_INVALID',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_REQUIRED',
    };
  }

  const keys = Object.keys(payload);
  const forbiddenAuthorityKeys = keys
    .filter((key) => REVIEW_EXACT_TEXT_APPLY_FORBIDDEN_AUTHORITY_KEYS.includes(key))
    .sort();
  const unsupportedKeys = keys
    .filter((key) => !REVIEW_EXACT_TEXT_APPLY_BATCH_ALLOWED_PAYLOAD_KEYS.includes(key))
    .sort();
  if (forbiddenAuthorityKeys.length > 0 || unsupportedKeys.length > 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_INVALID',
      reason: forbiddenAuthorityKeys.length > 0
        ? 'REVIEW_EXACT_TEXT_APPLY_BATCH_RENDERER_AUTHORITY_DENIED'
        : 'REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_UNSUPPORTED_FIELDS',
      details: {
        fields: forbiddenAuthorityKeys.length > 0 ? forbiddenAuthorityKeys : unsupportedKeys,
      },
    };
  }

  if (!Array.isArray(payload.changeIds)) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_INVALID',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_CHANGE_IDS_REQUIRED',
    };
  }

  const changeIds = payload.changeIds
    .map((changeId) => (typeof changeId === 'string' ? changeId.trim() : ''))
    .filter(Boolean);
  const uniqueChangeIds = [...new Set(changeIds)];
  if (changeIds.length === 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_INVALID',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_CHANGE_IDS_EMPTY',
    };
  }
  if (uniqueChangeIds.length !== changeIds.length) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_INVALID',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_DUPLICATE_CHANGE_ID',
    };
  }
  if (changeIds.length > REVIEW_EXACT_TEXT_APPLY_BATCH_MAX_CHANGE_IDS) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_PAYLOAD_INVALID',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_LIMIT_EXCEEDED',
      details: {
        limit: REVIEW_EXACT_TEXT_APPLY_BATCH_MAX_CHANGE_IDS,
        requested: changeIds.length,
      },
    };
  }

  const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
  return {
    ok: true,
    value: {
      ...(requestId ? { requestId } : {}),
      changeIds,
    },
  };
}

function readReviewExactTextRevisionSession(sessionStore) {
  if (!isPlainObjectValue(sessionStore)) return {};
  if (isPlainObjectValue(sessionStore.revisionSession)) {
    return cloneJsonSafe(sessionStore.revisionSession) || {};
  }
  if (isPlainObjectValue(sessionStore.reviewSurface?.revisionSession)) {
    return cloneJsonSafe(sessionStore.reviewSurface.revisionSession) || {};
  }
  return {};
}

function readReviewExactTextReviewGraph(revisionSession) {
  return isPlainObjectValue(revisionSession?.reviewGraph) ? revisionSession.reviewGraph : {};
}

function readReviewExactTextChangeCollections(revisionSession) {
  const reviewGraph = readReviewExactTextReviewGraph(revisionSession);
  return {
    textChanges: Array.isArray(reviewGraph.textChanges)
      ? reviewGraph.textChanges.filter((change) => isPlainObjectValue(change))
      : [],
    structuralChanges: Array.isArray(reviewGraph.structuralChanges)
      ? reviewGraph.structuralChanges.filter((change) => isPlainObjectValue(change))
      : [],
    commentThreads: Array.isArray(reviewGraph.commentThreads)
      ? reviewGraph.commentThreads.filter((thread) => isPlainObjectValue(thread))
      : [],
    commentPlacements: Array.isArray(reviewGraph.commentPlacements)
      ? reviewGraph.commentPlacements.filter((placement) => isPlainObjectValue(placement))
      : [],
  };
}

function selectReviewExactTextChange(revisionSession, payload = {}) {
  const {
    textChanges,
    structuralChanges,
    commentThreads,
    commentPlacements,
  } = readReviewExactTextChangeCollections(revisionSession);

  if (structuralChanges.length > 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_STRUCTURAL_CHANGE_BLOCKED',
    };
  }
  if (textChanges.length === 0 && (commentThreads.length > 0 || commentPlacements.length > 0)) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_COMMENT_ONLY_BLOCKED',
    };
  }
  if (textChanges.length !== 1) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_SINGLE_TEXT_CHANGE_REQUIRED',
      details: {
        textChangeCount: textChanges.length,
      },
    };
  }

  const textChange = cloneJsonSafe(textChanges[0]) || {};
  const expectedChangeId = typeof payload.changeId === 'string' ? payload.changeId.trim() : '';
  const changeId = typeof textChange.changeId === 'string' ? textChange.changeId.trim() : '';
  if (expectedChangeId && expectedChangeId !== changeId) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_CHANGE_ID_MISMATCH',
      details: {
        expectedChangeId,
        observedChangeId: changeId,
      },
    };
  }

  return {
    ok: true,
    value: {
      textChange,
      reviewItem: textChange,
    },
  };
}

function selectReviewExactTextChangesBatch(revisionSession, payload = {}) {
  const {
    textChanges,
    structuralChanges,
    commentThreads,
    commentPlacements,
  } = readReviewExactTextChangeCollections(revisionSession);
  if (structuralChanges.length > 0 || commentThreads.length > 0 || commentPlacements.length > 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_MIXED_REVIEW_BLOCKED',
      details: {
        structuralChangeCount: structuralChanges.length,
        commentThreadCount: commentThreads.length,
        commentPlacementCount: commentPlacements.length,
      },
    };
  }
  if (textChanges.length === 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_TEXT_CHANGES_REQUIRED',
    };
  }

  const changeIds = Array.isArray(payload.changeIds) ? payload.changeIds : [];
  const textChangesById = new Map();
  for (const change of textChanges) {
    const changeId = typeof change.changeId === 'string' ? change.changeId.trim() : '';
    if (changeId) textChangesById.set(changeId, cloneJsonSafe(change) || {});
  }

  const unknownChangeIds = changeIds.filter((changeId) => !textChangesById.has(changeId));
  if (unknownChangeIds.length > 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_UNKNOWN_CHANGE_ID',
      details: {
        changeIds: unknownChangeIds,
      },
    };
  }

  const selectedTextChanges = changeIds.map((changeId) => textChangesById.get(changeId));
  const selectedSceneIds = [...new Set(selectedTextChanges
    .map((change) => (typeof change?.targetScope?.id === 'string' ? change.targetScope.id.trim() : ''))
    .filter(Boolean))];
  const selectedTargetScopeTypes = [...new Set(selectedTextChanges
    .map((change) => (typeof change?.targetScope?.type === 'string' ? change.targetScope.type.trim() : ''))
    .filter(Boolean))];
  if (
    selectedSceneIds.length !== 1
    || selectedTargetScopeTypes.length !== 1
    || selectedTargetScopeTypes[0] !== 'scene'
  ) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_SINGLE_SCENE_REQUIRED',
      details: {
        sceneIds: selectedSceneIds,
        targetScopeTypes: selectedTargetScopeTypes,
      },
    };
  }

  const nonExactChangeIds = selectedTextChanges
    .filter((change) => {
      const matchKind = typeof change?.match?.kind === 'string' ? change.match.kind.trim() : '';
      return matchKind && matchKind !== 'exact';
    })
    .map((change) => (typeof change?.changeId === 'string' ? change.changeId.trim() : ''))
    .filter(Boolean);
  if (nonExactChangeIds.length > 0) {
    return {
      ok: false,
      code: 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED',
      reason: 'REVIEW_EXACT_TEXT_APPLY_BATCH_EXACT_MATCH_REQUIRED',
      details: {
        changeIds: nonExactChangeIds,
      },
    };
  }

  return {
    ok: true,
    value: {
      textChanges: selectedTextChanges,
    },
  };
}

function summarizeReviewExactTextSafeWriteResult(result) {
  if (!isPlainObjectValue(result)) return {};
  const summary = {
    status: typeof result.status === 'string' ? result.status : '',
    code: typeof result.code === 'string' ? result.code : '',
    reason: typeof result.reason === 'string' ? result.reason : '',
    applied: result.applied === true,
  };
  if (Array.isArray(result.reasons)) {
    summary.reasons = result.reasons
      .filter((reason) => isPlainObjectValue(reason))
      .map((reason) => ({
        code: typeof reason.code === 'string' ? reason.code : '',
        field: typeof reason.field === 'string' ? reason.field : '',
        message: typeof reason.message === 'string' ? reason.message : '',
        rebuiltCode: typeof reason.rebuiltCode === 'string' ? reason.rebuiltCode : '',
        rebuiltReason: typeof reason.rebuiltReason === 'string' ? reason.rebuiltReason : '',
        rebuiltReasons: Array.isArray(reason.rebuiltReasons)
          ? reason.rebuiltReasons
            .filter((rebuiltReason) => isPlainObjectValue(rebuiltReason))
            .map((rebuiltReason) => ({
              code: typeof rebuiltReason.code === 'string' ? rebuiltReason.code : '',
              field: typeof rebuiltReason.field === 'string' ? rebuiltReason.field : '',
              message: typeof rebuiltReason.message === 'string' ? rebuiltReason.message : '',
            }))
          : [],
      }));
  }
  return summary;
}

function readReviewExactTextAppliedReceiptForChange(sessionStore, revisionSession, changeId) {
  const normalizedChangeId = typeof changeId === 'string' ? changeId.trim() : '';
  if (!normalizedChangeId || !isPlainObjectValue(sessionStore)) return null;

  const expectedProjectId = typeof revisionSession?.projectId === 'string' ? revisionSession.projectId.trim() : '';
  const expectedSessionId = typeof revisionSession?.sessionId === 'string' ? revisionSession.sessionId.trim() : '';
  const candidates = [
    sessionStore.lastExactTextApplyReceipt,
    sessionStore.reviewSurface?.receipt,
    ...(Array.isArray(sessionStore.lastExactTextApplyReceipts) ? sessionStore.lastExactTextApplyReceipts : []),
    ...(Array.isArray(sessionStore.reviewSurface?.exactTextApplyReceipts)
      ? sessionStore.reviewSurface.exactTextApplyReceipts
      : []),
  ];

  for (const receipt of candidates) {
    if (!isPlainObjectValue(receipt)) continue;
    const receiptChangeId = typeof receipt.changeId === 'string' ? receipt.changeId.trim() : '';
    const receiptProjectId = typeof receipt.projectId === 'string' ? receipt.projectId.trim() : '';
    const receiptSessionId = typeof receipt.sessionId === 'string' ? receipt.sessionId.trim() : '';
    const receiptOperationKind = typeof receipt.operationKind === 'string' ? receipt.operationKind.trim() : '';
    const receiptWriteStatus = typeof receipt.writeStatus === 'string' ? receipt.writeStatus.trim() : '';

    if (
      receiptChangeId === normalizedChangeId
      && receiptWriteStatus === 'applied'
      && receiptOperationKind === 'replaceExactText'
      && (!expectedProjectId || receiptProjectId === expectedProjectId)
      && (!expectedSessionId || receiptSessionId === expectedSessionId)
    ) {
      return cloneJsonSafe(receipt) || null;
    }
  }

  return null;
}

function makeReviewExactTextAlreadyAppliedError(appliedReceipt, liveDetails = {}, commandId = REVIEW_EXACT_TEXT_APPLY_COMMAND_ID) {
  return makeReviewMutateTypedError(
    commandId,
    'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
    'REVIEW_EXACT_TEXT_APPLY_ALREADY_APPLIED',
    {
      changeId: typeof appliedReceipt?.changeId === 'string' ? appliedReceipt.changeId : '',
      sessionId: typeof appliedReceipt?.sessionId === 'string' ? appliedReceipt.sessionId : '',
      transactionId: typeof appliedReceipt?.transactionId === 'string' ? appliedReceipt.transactionId : '',
      writtenAt: typeof appliedReceipt?.writtenAt === 'string' ? appliedReceipt.writtenAt : '',
      ...(
        isPlainObjectValue(liveDetails)
          ? cloneJsonSafe(liveDetails)
          : {}
      ),
    },
  );
}

function upsertReviewExactTextApplyReceipt(receipts, receipt) {
  if (!isPlainObjectValue(receipt)) return Array.isArray(receipts) ? cloneJsonSafe(receipts) || [] : [];
  const normalizedChangeId = typeof receipt.changeId === 'string' ? receipt.changeId.trim() : '';
  const existingReceipts = Array.isArray(receipts)
    ? receipts.filter((candidate) => isPlainObjectValue(candidate))
    : [];
  const withoutCurrent = normalizedChangeId
    ? existingReceipts.filter((candidate) => {
      const candidateChangeId = typeof candidate.changeId === 'string' ? candidate.changeId.trim() : '';
      return candidateChangeId !== normalizedChangeId;
    })
    : existingReceipts;
  return [...withoutCurrent, cloneJsonSafe(receipt)].filter((candidate) => isPlainObjectValue(candidate));
}

function attachReviewExactTextApplyReceipt(receipt, safeWriteResult) {
  if (
    activeReviewSessionLifecycle !== 'active'
    || !isPlainObjectValue(activeReviewSessionStore)
    || !isPlainObjectValue(receipt)
  ) {
    return {};
  }

  const nextSessionStore = cloneJsonSafe(activeReviewSessionStore) || {};
  const nextReviewSurface = isPlainObjectValue(nextSessionStore.reviewSurface)
    ? cloneJsonSafe(nextSessionStore.reviewSurface) || {}
    : {};
  const nextReceipts = upsertReviewExactTextApplyReceipt(
    nextReviewSurface.exactTextApplyReceipts,
    receipt,
  );
  nextReviewSurface.receipt = cloneJsonSafe(receipt);
  nextReviewSurface.exactTextApplyReceipts = nextReceipts;
  nextReviewSurface.exactTextApplyResult = summarizeReviewExactTextSafeWriteResult(safeWriteResult);
  nextSessionStore.reviewSurface = nextReviewSurface;
  nextSessionStore.lastExactTextApplyReceipt = cloneJsonSafe(receipt);
  nextSessionStore.lastExactTextApplyReceipts = nextReceipts;
  activeReviewSessionStore = nextSessionStore;
  currentReviewSurfacePayload = cloneJsonSafe(nextReviewSurface) || {};
  currentReviewSurfacePayloadSource = 'session';
  currentReviewSurfacePayloadContentHash = '';
  return readActiveReviewSessionReviewSurface();
}

async function handleReviewSurfaceApplyExactTextChangeCommandSurface(payload = {}, options = {}) {
  const normalizedPayload = normalizeReviewExactTextApplyPayload(payload);
  if (!normalizedPayload.ok) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_COMMAND_ID,
      normalizedPayload.code,
      normalizedPayload.reason,
      normalizedPayload.details,
    );
  }

  if (activeReviewSessionLifecycle !== 'active' || !isPlainObjectValue(activeReviewSessionStore)) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_NO_ACTIVE_SESSION',
      'REVIEW_EXACT_TEXT_APPLY_NO_ACTIVE_SESSION',
    );
  }

  const activeSession = cloneActiveReviewSessionStore();
  const revisionSession = readReviewExactTextRevisionSession(activeSession);
  if (!isPlainObjectValue(revisionSession) || Object.keys(revisionSession).length === 0) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      'REVIEW_EXACT_TEXT_APPLY_SESSION_REQUIRED',
    );
  }

  const selected = selectReviewExactTextChange(revisionSession, normalizedPayload.value);
  if (!selected.ok) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_COMMAND_ID,
      selected.code,
      selected.reason,
      selected.details,
    );
  }

  return runReviewSurfaceApplyExactTextChangeInternal({
    commandId: REVIEW_EXACT_TEXT_APPLY_COMMAND_ID,
    activeSession,
    payload: normalizedPayload.value,
    revisionSession,
    selected,
    options,
  });
}

async function runReviewSurfaceApplyExactTextChangeInternal({
  commandId = REVIEW_EXACT_TEXT_APPLY_COMMAND_ID,
  activeSession = {},
  payload = {},
  revisionSession = {},
  selected = {},
  options = {},
} = {}) {
  if (!isPlainObjectValue(selected?.value?.textChange)) {
    return makeReviewMutateTypedError(
      commandId,
      'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      'REVIEW_EXACT_TEXT_APPLY_TEXT_CHANGE_REQUIRED',
    );
  }

  const appliedReceipt = readReviewExactTextAppliedReceiptForChange(
    activeSession,
    revisionSession,
    selected.value.textChange.changeId,
  );

  const loadSafeWrite = typeof options.loadExactTextMinSafeWriteModule === 'function'
    ? options.loadExactTextMinSafeWriteModule
    : (typeof loadExactTextMinSafeWriteModule === 'function' ? loadExactTextMinSafeWriteModule : null);
  const buildApplyInput = typeof options.buildReviewExactTextApplyInput === 'function'
    ? options.buildReviewExactTextApplyInput
    : (typeof buildReviewExactTextApplyInputFromMainState === 'function'
      ? buildReviewExactTextApplyInputFromMainState
      : null);
  const runSafeWrite = typeof options.runReviewExactTextSafeWrite === 'function'
    ? options.runReviewExactTextSafeWrite
    : (typeof runReviewExactTextSafeWriteFromMainState === 'function'
      ? runReviewExactTextSafeWriteFromMainState
      : async (applyExactTextMinSafeWrite, input, safeWriteOptions) => (
        applyExactTextMinSafeWrite(input, safeWriteOptions)
      ));
  const syncEditorAfterApply = typeof options.syncReviewExactTextApplyEditor === 'function'
    ? options.syncReviewExactTextApplyEditor
    : (typeof syncReviewExactTextApplyEditorFromMainState === 'function'
      ? syncReviewExactTextApplyEditorFromMainState
      : null);

  if (!loadSafeWrite || !buildApplyInput) {
    return makeReviewMutateTypedError(
      commandId,
      'E_REVIEW_EXACT_TEXT_APPLY_UNAVAILABLE',
      'REVIEW_EXACT_TEXT_APPLY_CONTEXT_UNAVAILABLE',
    );
  }

  let applyContext = null;
  try {
    applyContext = await buildApplyInput({
      activeSession,
      payload,
      revisionSession,
      textChange: selected.value.textChange,
      reviewItem: selected.value.reviewItem,
    });
  } catch (error) {
    return makeReviewMutateTypedError(
      commandId,
      'E_REVIEW_EXACT_TEXT_APPLY_CONTEXT_FAILED',
      'REVIEW_EXACT_TEXT_APPLY_CONTEXT_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!isPlainObjectValue(applyContext) || applyContext.ok !== true || !isPlainObjectValue(applyContext.input)) {
    if (appliedReceipt && applyContext?.reason === 'REVIEW_EXACT_TEXT_APPLY_PLAN_BLOCKED') {
      return makeReviewExactTextAlreadyAppliedError(appliedReceipt, {
        livePlanStatus: 'blocked',
        livePlanReason: typeof applyContext?.details?.planReason === 'string'
          ? applyContext.details.planReason
          : '',
        livePlanCode: typeof applyContext?.details?.planCode === 'string'
          ? applyContext.details.planCode
          : '',
      }, commandId);
    }
    return makeReviewMutateTypedError(
      commandId,
      typeof applyContext?.code === 'string' ? applyContext.code : 'E_REVIEW_EXACT_TEXT_APPLY_CONTEXT_BLOCKED',
      typeof applyContext?.reason === 'string' ? applyContext.reason : 'REVIEW_EXACT_TEXT_APPLY_CONTEXT_BLOCKED',
      isPlainObjectValue(applyContext?.details) ? applyContext.details : undefined,
    );
  }

  if (appliedReceipt) {
    return makeReviewExactTextAlreadyAppliedError(appliedReceipt, {
      livePlanStatus: 'ready',
    }, commandId);
  }

  let safeWriteModule = null;
  try {
    safeWriteModule = await loadSafeWrite();
  } catch (error) {
    return makeReviewMutateTypedError(
      commandId,
      'E_REVIEW_EXACT_TEXT_APPLY_UNAVAILABLE',
      'REVIEW_EXACT_TEXT_APPLY_SAFE_WRITE_UNAVAILABLE',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!safeWriteModule || typeof safeWriteModule.applyExactTextMinSafeWrite !== 'function') {
    return makeReviewMutateTypedError(
      commandId,
      'E_REVIEW_EXACT_TEXT_APPLY_UNAVAILABLE',
      'REVIEW_EXACT_TEXT_APPLY_SAFE_WRITE_UNAVAILABLE',
    );
  }

  let safeWriteResult = null;
  try {
    safeWriteResult = await runSafeWrite(
      safeWriteModule.applyExactTextMinSafeWrite,
      applyContext.input,
      isPlainObjectValue(options.safeWriteOptions) ? options.safeWriteOptions : {},
    );
  } catch (error) {
    return makeReviewMutateTypedError(
      commandId,
      'E_REVIEW_EXACT_TEXT_APPLY_FAILED',
      'REVIEW_EXACT_TEXT_APPLY_SAFE_WRITE_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!isPlainObjectValue(safeWriteResult) || safeWriteResult.ok !== true || !isPlainObjectValue(safeWriteResult.receipt)) {
    return makeReviewMutateTypedError(
      commandId,
      typeof safeWriteResult?.code === 'string' ? safeWriteResult.code : 'E_REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      typeof safeWriteResult?.reason === 'string' ? safeWriteResult.reason : 'REVIEW_EXACT_TEXT_APPLY_BLOCKED',
      summarizeReviewExactTextSafeWriteResult(safeWriteResult),
    );
  }

  const reviewSurface = attachReviewExactTextApplyReceipt(safeWriteResult.receipt, safeWriteResult);
  let editorSync = { ok: false, skipped: true };
  if (syncEditorAfterApply) {
    try {
      const syncResult = await syncEditorAfterApply({
        applyInput: applyContext.input,
        reviewSurface,
        receipt: safeWriteResult.receipt,
      });
      editorSync = isPlainObjectValue(syncResult) ? cloneJsonSafe(syncResult) : { ok: false, skipped: true };
    } catch (error) {
      editorSync = {
        ok: false,
        skipped: false,
        reason: 'REVIEW_EXACT_TEXT_APPLY_EDITOR_SYNC_FAILED',
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      };
    }
  }
  return {
    ok: true,
    applied: true,
    receipt: cloneJsonSafe(safeWriteResult.receipt),
    result: summarizeReviewExactTextSafeWriteResult(safeWriteResult),
    reviewSurface,
    editorSync,
  };
}

function summarizeReviewExactTextBatchSafeWriteResult(result) {
  if (!isPlainObjectValue(result)) return {};
  return {
    status: typeof result.status === 'string' ? result.status : '',
    code: typeof result.code === 'string' ? result.code : '',
    reason: typeof result.reason === 'string' ? result.reason : '',
    applied: result.applied === true,
    changes: Array.isArray(result.changes)
      ? result.changes
        .filter((change) => isPlainObjectValue(change))
        .map((change) => ({
          changeId: typeof change.changeId === 'string' ? change.changeId : '',
          status: typeof change.status === 'string' ? change.status : '',
          reason: typeof change.reason === 'string' ? change.reason : '',
        }))
      : [],
    receipt: isPlainObjectValue(result.receipt) ? cloneJsonSafe(result.receipt) : null,
  };
}

function attachReviewExactTextApplyBatchResult(safeWriteResult) {
  if (
    activeReviewSessionLifecycle !== 'active'
    || !isPlainObjectValue(activeReviewSessionStore)
    || !isPlainObjectValue(safeWriteResult)
  ) {
    return {};
  }

  const nextSessionStore = cloneJsonSafe(activeReviewSessionStore) || {};
  const nextReviewSurface = isPlainObjectValue(nextSessionStore.reviewSurface)
    ? cloneJsonSafe(nextSessionStore.reviewSurface) || {}
    : {};
  const summary = summarizeReviewExactTextBatchSafeWriteResult(safeWriteResult);
  const existingAppliedChangeIds = Array.isArray(nextReviewSurface.exactTextAppliedChangeIds)
    ? nextReviewSurface.exactTextAppliedChangeIds.filter((changeId) => typeof changeId === 'string')
    : [];
  const batchAppliedChangeIds = Array.isArray(summary.changes)
    ? summary.changes
      .filter((change) => change.status === 'applied' && change.changeId)
      .map((change) => change.changeId)
    : [];
  nextReviewSurface.exactTextAppliedChangeIds = [...new Set([
    ...existingAppliedChangeIds,
    ...batchAppliedChangeIds,
  ])];
  nextReviewSurface.exactTextBatchApplyResult = summary;
  nextSessionStore.reviewSurface = nextReviewSurface;
  nextSessionStore.lastExactTextApplyBatchResult = summary;
  activeReviewSessionStore = nextSessionStore;
  currentReviewSurfacePayload = cloneJsonSafe(nextReviewSurface) || {};
  currentReviewSurfacePayloadSource = 'session';
  currentReviewSurfacePayloadContentHash = '';
  return readActiveReviewSessionReviewSurface();
}

function makeReviewExactTextApplyBatchResponseFromSafeWrite(safeWriteResult) {
  const summary = summarizeReviewExactTextBatchSafeWriteResult(safeWriteResult);
  const requested = Array.isArray(summary.changes) && summary.changes.length > 0
    ? summary.changes.length
    : 0;
  const applied = summary.changes.filter((change) => change.status === 'applied').length;
  const failed = safeWriteResult?.status === 'failed' ? 1 : 0;
  const blocked = safeWriteResult?.status === 'blocked' ? 1 : 0;
  return {
    ok: true,
    batch: true,
    applied: summary.applied === true,
    status: summary.applied === true ? 'applied' : (safeWriteResult?.status || 'blocked'),
    reason: summary.reason,
    totals: {
      requested,
      applied,
      blocked,
      failed,
      skipped: summary.applied === true ? 0 : requested,
    },
    changes: summary.applied === true
      ? summary.changes
      : [],
    result: summary,
    reviewSurface: readActiveReviewSessionReviewSurface(),
  };
}

async function handleReviewSurfaceApplyExactTextChangesBatchCommandSurface(payload = {}, options = {}) {
  const normalizedPayload = normalizeReviewExactTextApplyBatchPayload(payload);
  if (!normalizedPayload.ok) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      normalizedPayload.code,
      normalizedPayload.reason,
      normalizedPayload.details,
    );
  }

  if (activeReviewSessionLifecycle !== 'active' || !isPlainObjectValue(activeReviewSessionStore)) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BATCH_NO_ACTIVE_SESSION',
      'REVIEW_EXACT_TEXT_APPLY_BATCH_NO_ACTIVE_SESSION',
    );
  }

  const initialSession = cloneActiveReviewSessionStore();
  const initialRevisionSession = readReviewExactTextRevisionSession(initialSession);
  if (!isPlainObjectValue(initialRevisionSession) || Object.keys(initialRevisionSession).length === 0) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED',
      'REVIEW_EXACT_TEXT_APPLY_BATCH_SESSION_REQUIRED',
    );
  }

  const selectedBatch = selectReviewExactTextChangesBatch(initialRevisionSession, normalizedPayload.value);
  if (!selectedBatch.ok) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      selectedBatch.code,
      selectedBatch.reason,
      selectedBatch.details,
    );
  }

  const buildBatchInput = typeof options.buildReviewExactTextApplyBatchInput === 'function'
    ? options.buildReviewExactTextApplyBatchInput
    : (typeof buildReviewExactTextApplyBatchInputFromMainState === 'function'
      ? buildReviewExactTextApplyBatchInputFromMainState
      : null);
  const loadSafeWrite = typeof options.loadExactTextMinSafeWriteModule === 'function'
    ? options.loadExactTextMinSafeWriteModule
    : (typeof loadExactTextMinSafeWriteModule === 'function' ? loadExactTextMinSafeWriteModule : null);
  const runBatchSafeWrite = typeof options.runReviewExactTextBatchSafeWrite === 'function'
    ? options.runReviewExactTextBatchSafeWrite
    : (typeof runReviewExactTextBatchSafeWriteFromMainState === 'function'
      ? runReviewExactTextBatchSafeWriteFromMainState
      : async (applyExactTextBatchMinSafeWrite, input, safeWriteOptions) => (
        applyExactTextBatchMinSafeWrite(input, safeWriteOptions)
      ));
  if (!buildBatchInput || !loadSafeWrite) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BATCH_UNAVAILABLE',
      'REVIEW_EXACT_TEXT_APPLY_BATCH_CONTEXT_UNAVAILABLE',
    );
  }

  let applyContext = null;
  try {
    applyContext = await buildBatchInput({
      activeSession: initialSession,
      payload: normalizedPayload.value,
      revisionSession: initialRevisionSession,
      textChanges: selectedBatch.value.textChanges,
    });
  } catch (error) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BATCH_CONTEXT_FAILED',
      'REVIEW_EXACT_TEXT_APPLY_BATCH_CONTEXT_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!isPlainObjectValue(applyContext) || applyContext.ok !== true || !isPlainObjectValue(applyContext.input)) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      typeof applyContext?.code === 'string' ? applyContext.code : 'E_REVIEW_EXACT_TEXT_APPLY_BATCH_CONTEXT_BLOCKED',
      typeof applyContext?.reason === 'string' ? applyContext.reason : 'REVIEW_EXACT_TEXT_APPLY_BATCH_CONTEXT_BLOCKED',
      isPlainObjectValue(applyContext?.details) ? applyContext.details : undefined,
    );
  }

  let safeWriteModule = null;
  try {
    safeWriteModule = await loadSafeWrite();
  } catch (error) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BATCH_UNAVAILABLE',
      'REVIEW_EXACT_TEXT_APPLY_BATCH_SAFE_WRITE_UNAVAILABLE',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!safeWriteModule || typeof safeWriteModule.applyExactTextBatchMinSafeWrite !== 'function') {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BATCH_UNAVAILABLE',
      'REVIEW_EXACT_TEXT_APPLY_BATCH_SAFE_WRITE_UNAVAILABLE',
    );
  }

  let safeWriteResult = null;
  try {
    safeWriteResult = await runBatchSafeWrite(
      safeWriteModule.applyExactTextBatchMinSafeWrite,
      applyContext.input,
      isPlainObjectValue(options.safeWriteOptions) ? options.safeWriteOptions : {},
    );
  } catch (error) {
    return makeReviewMutateTypedError(
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
      'E_REVIEW_EXACT_TEXT_APPLY_BATCH_FAILED',
      'REVIEW_EXACT_TEXT_APPLY_BATCH_SAFE_WRITE_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!isPlainObjectValue(safeWriteResult) || safeWriteResult.ok !== true || safeWriteResult.applied !== true) {
    return makeReviewExactTextApplyBatchResponseFromSafeWrite(safeWriteResult);
  }

  const reviewSurface = attachReviewExactTextApplyBatchResult(safeWriteResult);
  return {
    ...makeReviewExactTextApplyBatchResponseFromSafeWrite(safeWriteResult),
    reviewSurface,
  };
}
// CONTOUR_01A_REVIEW_MUTATE_PORT_END

// REVIEW_LOCAL_PACKET_COMMAND_SURFACE_START
const REVIEW_IMPORT_LOCAL_PACKET_COMMAND_ID = 'cmd.project.review.importLocalPacket';
const REVIEW_IMPORT_LOCAL_PACKET_MAX_BYTES = 2 * 1024 * 1024;
const REVIEW_IMPORT_LOCAL_PACKET_ALLOWED_PAYLOAD_KEYS = new Set(['requestId']);
const REVIEW_IMPORT_LOCAL_PACKET_ALLOWED_SELECTION_KEYS = new Set(['path', 'filePath', 'name', 'size', 'requestId', 'canceled']);
const REVIEW_IMPORT_LOCAL_PACKET_FORBIDDEN_WRITE_EVIDENCE_KEYS = new Set([
  'receipt',
  'exactTextApplyReceipts',
  'lastExactTextApplyReceipt',
  'lastExactTextApplyReceipts',
  'exactTextApplyResult',
  'lastExactTextApplyResult',
  'exactTextAppliedChangeIds',
  'exactTextBatchApplyResult',
  'lastExactTextApplyBatchResult',
]);

function makeReviewImportLocalPacketTypedError(code, reason, details = undefined) {
  return makeReviewMutateTypedError(REVIEW_IMPORT_LOCAL_PACKET_COMMAND_ID, code, reason, details);
}

function normalizeReviewImportLocalPacketRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'review-import-local-packet-request';
}

function getReviewImportLocalPacketByteLength(text) {
  if (typeof Buffer !== 'undefined' && Buffer && typeof Buffer.byteLength === 'function') {
    return Buffer.byteLength(String(text || ''), 'utf8');
  }
  return String(text || '').length;
}

function makeReviewImportLocalPacketReadError(code, reason, details = undefined) {
  const error = new Error(reason);
  error.code = code;
  error.reason = reason;
  if (isPlainObjectValue(details)) {
    error.details = details;
  }
  return error;
}

function findReviewImportLocalPacketForbiddenWriteEvidence(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => (
      findReviewImportLocalPacketForbiddenWriteEvidence(item, pathParts.concat(String(index)))
    ));
  }
  if (!isPlainObjectValue(value)) {
    return [];
  }

  return Object.keys(value).flatMap((key) => {
    const keyPath = pathParts.concat(key);
    const nested = findReviewImportLocalPacketForbiddenWriteEvidence(value[key], keyPath);
    return REVIEW_IMPORT_LOCAL_PACKET_FORBIDDEN_WRITE_EVIDENCE_KEYS.has(key)
      ? [keyPath.join('.'), ...nested]
      : nested;
  });
}

async function pickReviewImportLocalPacketFile(options = {}) {
  const dialogResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Review Packet',
    defaultPath: fileManager.getDocumentsPath(),
    filters: [{ name: 'Review Packet JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (!dialogResult || dialogResult.canceled === true) {
    return { canceled: true };
  }

  const filePath = Array.isArray(dialogResult.filePaths) && typeof dialogResult.filePaths[0] === 'string'
    ? dialogResult.filePaths[0].trim()
    : '';
  if (!filePath) {
    return {};
  }

  let size = null;
  try {
    const stat = await fs.stat(filePath);
    if (stat && typeof stat.isFile === 'function' && stat.isFile()) {
      size = Number.isFinite(stat.size) && stat.size >= 0 ? Math.floor(stat.size) : null;
    }
  } catch {}

  return {
    path: filePath,
    name: path.basename(filePath),
    size,
    requestId: normalizeReviewImportLocalPacketRequestId(options.requestId),
  };
}

function validateReviewImportLocalPacketSelection(selection, requestId) {
  if (!isPlainObjectValue(selection)) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
    );
  }

  const unsupportedKeys = Object.keys(selection)
    .filter((key) => !REVIEW_IMPORT_LOCAL_PACKET_ALLOWED_SELECTION_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_SELECTION_UNSUPPORTED_FIELDS',
      { fields: unsupportedKeys },
    );
  }

  const filePath = typeof selection.path === 'string' && selection.path.trim()
    ? selection.path.trim()
    : typeof selection.filePath === 'string' && selection.filePath.trim()
      ? selection.filePath.trim()
      : '';
  if (!filePath) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_FILE_REQUIRED',
    );
  }

  if (path.extname(filePath).toLowerCase() !== '.json') {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_JSON_REQUIRED',
    );
  }

  const size = Number.isFinite(selection.size) && selection.size >= 0
    ? Math.floor(selection.size)
    : null;
  if (size === null) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_SIZE_REQUIRED',
    );
  }
  if (size !== null && size > REVIEW_IMPORT_LOCAL_PACKET_MAX_BYTES) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_TOO_LARGE',
      'REVIEW_IMPORT_LOCAL_PACKET_TOO_LARGE',
      {
        maxBytes: REVIEW_IMPORT_LOCAL_PACKET_MAX_BYTES,
        actualBytes: size,
      },
    );
  }

  return {
    ok: true,
    value: {
      path: filePath,
      name: typeof selection.name === 'string' && selection.name.trim()
        ? path.basename(selection.name.trim())
        : path.basename(filePath),
      size,
      requestId,
    },
  };
}

async function readReviewImportLocalPacketText(selection) {
  if (!isPlainObjectValue(selection) || typeof selection.path !== 'string' || !selection.path.trim()) {
    throw new TypeError('REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID');
  }
  const filePath = selection.path.trim();
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    throw makeReviewImportLocalPacketReadError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_READ_FAILED',
      'REVIEW_IMPORT_LOCAL_PACKET_STAT_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!stat || typeof stat.isFile !== 'function' || !stat.isFile()) {
    throw makeReviewImportLocalPacketReadError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_FILE_REQUIRED',
    );
  }
  const actualBytes = Number.isFinite(stat.size) && stat.size >= 0
    ? Math.floor(stat.size)
    : null;
  if (actualBytes === null) {
    throw makeReviewImportLocalPacketReadError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_SELECTION_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_SIZE_REQUIRED',
    );
  }
  if (actualBytes > REVIEW_IMPORT_LOCAL_PACKET_MAX_BYTES) {
    throw makeReviewImportLocalPacketReadError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_TOO_LARGE',
      'REVIEW_IMPORT_LOCAL_PACKET_TOO_LARGE',
      {
        maxBytes: REVIEW_IMPORT_LOCAL_PACKET_MAX_BYTES,
        actualBytes,
      },
    );
  }
  return fs.readFile(filePath, 'utf8');
}

function parseReviewImportLocalPacketJson(text) {
  if (typeof text !== 'string') {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_READ_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_TEXT_REQUIRED',
    );
  }

  const actualBytes = getReviewImportLocalPacketByteLength(text);
  if (actualBytes > REVIEW_IMPORT_LOCAL_PACKET_MAX_BYTES) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_TOO_LARGE',
      'REVIEW_IMPORT_LOCAL_PACKET_TOO_LARGE',
      {
        maxBytes: REVIEW_IMPORT_LOCAL_PACKET_MAX_BYTES,
        actualBytes,
      },
    );
  }

  if (!text.trim()) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_JSON_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_EMPTY',
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_JSON_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_JSON_INVALID',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!isPlainObjectValue(parsed)) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_JSON_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_ROOT_OBJECT_REQUIRED',
    );
  }

  return { ok: true, value: parsed };
}

async function handleReviewSurfaceImportLocalPacketCommandSurface(payload = {}, options = {}) {
  const safePayload = isPlainObjectValue(payload) ? payload : {};
  const unsupportedPayloadKeys = Object.keys(safePayload)
    .filter((key) => !REVIEW_IMPORT_LOCAL_PACKET_ALLOWED_PAYLOAD_KEYS.has(key))
    .sort();
  if (unsupportedPayloadKeys.length > 0) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_PAYLOAD_INVALID',
      'REVIEW_IMPORT_LOCAL_PACKET_PAYLOAD_UNSUPPORTED_FIELDS',
      { fields: unsupportedPayloadKeys },
    );
  }

  const requestId = normalizeReviewImportLocalPacketRequestId(safePayload.requestId);
  const pickLocalFile = typeof options.pickLocalFile === 'function'
    ? options.pickLocalFile
    : pickReviewImportLocalPacketFile;
  const readLocalFileText = typeof options.readLocalFileText === 'function'
    ? options.readLocalFileText
    : readReviewImportLocalPacketText;

  let selectedFile;
  try {
    selectedFile = await pickLocalFile({ requestId });
  } catch (error) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_PICK_FAILED',
      'REVIEW_IMPORT_LOCAL_PACKET_PICK_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (selectedFile && selectedFile.canceled === true) {
    return {
      ok: true,
      commandId: REVIEW_IMPORT_LOCAL_PACKET_COMMAND_ID,
      requestId,
      imported: false,
      cancelled: true,
    };
  }

  const selection = validateReviewImportLocalPacketSelection(selectedFile, requestId);
  if (!selection.ok) {
    return selection;
  }

  let text;
  try {
    text = await readLocalFileText(selection.value);
  } catch (error) {
    const code = typeof error?.code === 'string' && error.code.startsWith('E_REVIEW_IMPORT_LOCAL_PACKET')
      ? error.code
      : 'E_REVIEW_IMPORT_LOCAL_PACKET_READ_FAILED';
    const reason = typeof error?.reason === 'string' && error.reason
      ? error.reason
      : 'REVIEW_IMPORT_LOCAL_PACKET_READ_FAILED';
    const details = isPlainObjectValue(error?.details)
      ? error.details
      : {
          message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
        };
    return makeReviewImportLocalPacketTypedError(
      code,
      reason,
      details,
    );
  }

  const parsed = parseReviewImportLocalPacketJson(text);
  if (!parsed.ok) {
    return parsed;
  }

  const forbiddenWriteEvidence = findReviewImportLocalPacketForbiddenWriteEvidence(parsed.value);
  if (forbiddenWriteEvidence.length > 0) {
    return makeReviewImportLocalPacketTypedError(
      'E_REVIEW_IMPORT_LOCAL_PACKET_WRITE_EVIDENCE_DENIED',
      'REVIEW_IMPORT_LOCAL_PACKET_WRITE_EVIDENCE_DENIED',
      {
        fields: forbiddenWriteEvidence.slice(0, 25),
      },
    );
  }

  const importResult = await handleReviewSurfaceImportPacketCommandSurface(parsed.value);
  if (!importResult || importResult.ok !== true) {
    const nestedError = isPlainObjectValue(importResult?.error) ? importResult.error : {};
    return makeReviewImportLocalPacketTypedError(
      typeof nestedError.code === 'string' && nestedError.code
        ? nestedError.code
        : 'E_REVIEW_IMPORT_LOCAL_PACKET_IMPORT_FAILED',
      typeof nestedError.reason === 'string' && nestedError.reason
        ? nestedError.reason
        : 'REVIEW_IMPORT_LOCAL_PACKET_IMPORT_FAILED',
      isPlainObjectValue(nestedError.details) ? nestedError.details : undefined,
    );
  }

  return {
    ok: true,
    commandId: REVIEW_IMPORT_LOCAL_PACKET_COMMAND_ID,
    requestId,
    imported: true,
    fileName: selection.value.name,
    session: importResult.session,
    reviewSurface: importResult.reviewSurface,
  };
}
// REVIEW_LOCAL_PACKET_COMMAND_SURFACE_END

// DOCX_INTAKE_GATE_COMMAND_SURFACE_START
const DOCX_INTAKE_GATE_COMMAND_ID = 'cmd.project.review.inspectDocxIntakeGate';
const DOCX_INTAKE_GATE_MAX_BYTES = 10 * 1024 * 1024;
const DOCX_INTAKE_GATE_MAX_BASE64_CHARS = Math.ceil(DOCX_INTAKE_GATE_MAX_BYTES / 3) * 4;
const DOCX_INTAKE_GATE_ALLOWED_PAYLOAD_KEYS = new Set(['requestId', 'bufferSource']);

function makeDocxIntakeGateTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_INTAKE_GATE_COMMAND_ID,
    reason,
  };
  if (isPlainObjectValue(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
}

function normalizeDocxIntakeGateRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'docx-intake-gate-request';
}

function decodeDocxIntakeGateBufferSource(payload = {}) {
  if (!isPlainObjectValue(payload)) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      'DOCX_INTAKE_GATE_PAYLOAD_REQUIRED',
    );
  }

  const unsupportedKeys = Object.keys(payload)
    .filter((key) => !DOCX_INTAKE_GATE_ALLOWED_PAYLOAD_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      'DOCX_INTAKE_GATE_PAYLOAD_UNSUPPORTED_FIELDS',
      {
        fields: unsupportedKeys,
      },
    );
  }

  const bufferSource = typeof payload.bufferSource === 'string'
    ? payload.bufferSource.trim()
    : '';
  if (!bufferSource) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      'DOCX_INTAKE_GATE_BUFFER_SOURCE_REQUIRED',
    );
  }
  if (bufferSource.length > DOCX_INTAKE_GATE_MAX_BASE64_CHARS) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_TOO_LARGE',
      'DOCX_INTAKE_GATE_BUFFER_SOURCE_TOO_LARGE',
      {
        maxBytes: DOCX_INTAKE_GATE_MAX_BYTES,
      },
    );
  }
  if (bufferSource.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(bufferSource)) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      'DOCX_INTAKE_GATE_BUFFER_SOURCE_BASE64_INVALID',
    );
  }

  const bytes = Buffer.from(bufferSource, 'base64');
  if (bytes.length === 0) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      'DOCX_INTAKE_GATE_BUFFER_SOURCE_EMPTY',
    );
  }
  if (bytes.length > DOCX_INTAKE_GATE_MAX_BYTES) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_TOO_LARGE',
      'DOCX_INTAKE_GATE_BUFFER_SOURCE_TOO_LARGE',
      {
        maxBytes: DOCX_INTAKE_GATE_MAX_BYTES,
        byteLength: bytes.length,
      },
    );
  }
  if (bytes.toString('base64') !== bufferSource) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      'DOCX_INTAKE_GATE_BUFFER_SOURCE_BASE64_INVALID',
    );
  }

  return {
    ok: true,
    bytes,
  };
}

function buildDocxIntakeGateCommandResult(payload, preflightResult) {
  const preflight = isPlainObjectValue(preflightResult) ? cloneJsonSafe(preflightResult) : {};
  const gate = isPlainObjectValue(preflight.gate) ? cloneJsonSafe(preflight.gate) : {};
  const parseSource = isPlainObjectValue(preflight.parse) ? preflight.parse : gate.parse;
  const parse = isPlainObjectValue(parseSource)
    ? cloneJsonSafe(parseSource)
    : {
      attempted: false,
      semanticAllowed: false,
    };
  const parseAttempted = parse.attempted === true;
  const preflightSummary = isPlainObjectValue(preflight.preflightSummary)
    ? cloneJsonSafe(preflight.preflightSummary)
    : {};
  return {
    ok: true,
    requestId: normalizeDocxIntakeGateRequestId(payload?.requestId),
    gatePass: gate.ok === true && gate.decision === 'pass',
    decision: typeof preflight.decision === 'string'
      ? preflight.decision
      : typeof gate.decision === 'string'
        ? gate.decision
        : 'blocked',
    code: typeof preflight.code === 'string'
      ? preflight.code
      : typeof gate.code === 'string'
        ? gate.code
        : 'E_DOCX_INTAKE_GATE_UNKNOWN',
    reason: typeof preflight.reason === 'string'
      ? preflight.reason
      : typeof gate.reason === 'string'
        ? gate.reason
        : 'E_DOCX_INTAKE_GATE_UNKNOWN',
    diagnostics: Array.isArray(preflight.diagnostics)
      ? cloneJsonSafe(preflight.diagnostics)
      : Array.isArray(gate.diagnostics)
        ? cloneJsonSafe(gate.diagnostics)
        : [],
    evidence: Array.isArray(preflight.evidence)
      ? cloneJsonSafe(preflight.evidence)
      : Array.isArray(gate.evidence)
        ? cloneJsonSafe(gate.evidence)
        : [],
    budgets: isPlainObjectValue(preflight.budgets)
      ? cloneJsonSafe(preflight.budgets)
      : isPlainObjectValue(gate.budgets)
        ? cloneJsonSafe(gate.budgets)
        : {},
    preflightSummary,
    packageInspection: isPlainObjectValue(preflight.packageInspection)
      ? cloneJsonSafe(preflight.packageInspection)
      : null,
    partPolicy: isPlainObjectValue(preflight.partPolicy)
      ? cloneJsonSafe(preflight.partPolicy)
      : null,
    parse,
    semanticParseNotRun: parseAttempted === false,
    gate,
  };
}

async function handleDocxIntakeGateCommandSurface(payload = {}) {
  const decoded = decodeDocxIntakeGateBufferSource(payload);
  if (!decoded.ok) return decoded;

  let revisionBridge = null;
  try {
    revisionBridge = await loadRevisionBridgeModule();
  } catch (error) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_UNAVAILABLE',
      'DOCX_INTAKE_GATE_BRIDGE_UNAVAILABLE',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!revisionBridge || typeof revisionBridge.buildDocxIntakePreflightReportFromZipBytes !== 'function') {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_UNAVAILABLE',
      'DOCX_INTAKE_GATE_INSPECTOR_UNAVAILABLE',
    );
  }

  let preflightResult = null;
  try {
    preflightResult = revisionBridge.buildDocxIntakePreflightReportFromZipBytes(decoded.bytes);
  } catch (error) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_FAILED',
      'DOCX_INTAKE_GATE_INSPECTION_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  const result = buildDocxIntakeGateCommandResult(payload, preflightResult);
  const gateParseAttempted = result.gate?.parse?.attempted === true;
  if (result.parse.attempted === true || gateParseAttempted || result.semanticParseNotRun !== true) {
    return makeDocxIntakeGateTypedError(
      'E_DOCX_INTAKE_GATE_PARSE_ATTEMPTED',
      'DOCX_INTAKE_GATE_PARSE_ATTEMPTED',
    );
  }
  return result;
}
// DOCX_INTAKE_GATE_COMMAND_SURFACE_END

// DOCX_REVIEW_PREFLIGHT_COMMAND_SURFACE_START
const DOCX_REVIEW_PREFLIGHT_COMMAND_ID = 'cmd.project.review.inspectDocxReviewPreflight';

function makeDocxReviewPreflightTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_REVIEW_PREFLIGHT_COMMAND_ID,
    reason,
  };
  if (isPlainObjectValue(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
}

function buildDocxReviewPreflightCommandResult(payload, reviewPreflightResult) {
  const report = isPlainObjectValue(reviewPreflightResult) ? cloneJsonSafe(reviewPreflightResult) : {};
  return {
    ...report,
    requestId: normalizeDocxIntakeGateRequestId(payload?.requestId),
    commandId: DOCX_REVIEW_PREFLIGHT_COMMAND_ID,
    canOpenReviewSession: false,
    canAutoApply: false,
    canCreateReviewPacket: false,
    canImportMutate: false,
    canWriteStorage: false,
  };
}

async function handleDocxReviewPreflightCommandSurface(payload = {}) {
  const decoded = decodeDocxIntakeGateBufferSource(payload);
  if (!decoded.ok) {
    return makeDocxReviewPreflightTypedError(
      decoded.error?.code || 'E_DOCX_REVIEW_PREFLIGHT_PAYLOAD_INVALID',
      decoded.error?.reason || 'DOCX_REVIEW_PREFLIGHT_PAYLOAD_INVALID',
      decoded.error?.details,
    );
  }

  let revisionBridge = null;
  try {
    revisionBridge = await loadRevisionBridgeModule();
  } catch (error) {
    return makeDocxReviewPreflightTypedError(
      'E_DOCX_REVIEW_PREFLIGHT_UNAVAILABLE',
      'DOCX_REVIEW_PREFLIGHT_BRIDGE_UNAVAILABLE',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!revisionBridge || typeof revisionBridge.buildDocxReviewPreflightReportFromZipBytes !== 'function') {
    return makeDocxReviewPreflightTypedError(
      'E_DOCX_REVIEW_PREFLIGHT_UNAVAILABLE',
      'DOCX_REVIEW_PREFLIGHT_INSPECTOR_UNAVAILABLE',
    );
  }

  let report = null;
  try {
    report = revisionBridge.buildDocxReviewPreflightReportFromZipBytes(decoded.bytes);
  } catch (error) {
    return makeDocxReviewPreflightTypedError(
      'E_DOCX_REVIEW_PREFLIGHT_FAILED',
      'DOCX_REVIEW_PREFLIGHT_INSPECTION_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  const result = buildDocxReviewPreflightCommandResult(payload, report);
  if (
    result.canOpenReviewSession !== false
    || result.canAutoApply !== false
    || result.canCreateReviewPacket !== false
    || result.canImportMutate !== false
    || result.canWriteStorage !== false
    || isPlainObjectValue(result.reviewSurface)
    || isPlainObjectValue(result.reviewPacket)
    || isPlainObjectValue(result.activeReviewSession)
    || Array.isArray(result.applyOps)
    || isPlainObjectValue(result.receipt)
    || isPlainObjectValue(result.recovery)
  ) {
    return makeDocxReviewPreflightTypedError(
      'E_DOCX_REVIEW_PREFLIGHT_FORBIDDEN_OUTPUT',
      'DOCX_REVIEW_PREFLIGHT_FORBIDDEN_OUTPUT',
    );
  }
  return result;
}
// DOCX_REVIEW_PREFLIGHT_COMMAND_SURFACE_END

// DOCX_REVIEW_PREVIEW_SESSION_COMMAND_SURFACE_START
const DOCX_REVIEW_PREVIEW_SESSION_COMMAND_ID = 'cmd.project.review.activateDocxReviewPreviewSession';
const DOCX_REVIEW_PREVIEW_SESSION_ALLOWED_CONTEXT_KINDS = new Set(['scene', 'chapter-file']);

function makeDocxReviewPreviewSessionTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_REVIEW_PREVIEW_SESSION_COMMAND_ID,
    reason,
  };
  if (isPlainObjectValue(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
}

function docxReviewPreviewSessionDetailString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

async function buildDocxReviewPreviewSessionMainContext(options = {}) {
  if (typeof options.buildMainReviewContext === 'function') {
    const result = await options.buildMainReviewContext();
    return isPlainObjectValue(result)
      ? result
      : {
        ok: false,
        code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
        reason: 'DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_INVALID',
      };
  }

  if (isDirty || autoSaveInProgress) {
    return {
      ok: false,
      code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: 'DOCX_REVIEW_PREVIEW_SESSION_DIRTY_EDITOR_BLOCKED',
      details: {
        isDirty: Boolean(isDirty),
        autoSaveInProgress: Boolean(autoSaveInProgress),
      },
    };
  }

  if (typeof currentFilePath !== 'string' || !currentFilePath.trim()) {
    return {
      ok: false,
      code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: 'DOCX_REVIEW_PREVIEW_SESSION_CURRENT_FILE_REQUIRED',
    };
  }
  if (!isAllowedFilePath(currentFilePath)) {
    return {
      ok: false,
      code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: 'DOCX_REVIEW_PREVIEW_SESSION_CURRENT_FILE_NOT_ALLOWED',
    };
  }

  const documentContext = getDocumentContextFromPath(currentFilePath);
  if (!DOCX_REVIEW_PREVIEW_SESSION_ALLOWED_CONTEXT_KINDS.has(documentContext.kind)) {
    return {
      ok: false,
      code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: 'DOCX_REVIEW_PREVIEW_SESSION_CURRENT_FILE_NOT_REVIEW_TARGET',
      details: {
        kind: docxReviewPreviewSessionDetailString(documentContext.kind),
      },
    };
  }

  const binding = await readReviewExactTextApplyProjectBinding(currentFilePath);
  if (!binding.ok) {
    return {
      ok: false,
      code: binding.code || 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: binding.reason || 'DOCX_REVIEW_PREVIEW_SESSION_PROJECT_BINDING_UNAVAILABLE',
      details: isPlainObjectValue(binding.details) ? binding.details : undefined,
    };
  }

  let content = '';
  try {
    content = await fs.readFile(currentFilePath, 'utf8');
  } catch (error) {
    return {
      ok: false,
      code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: 'DOCX_REVIEW_PREVIEW_SESSION_CURRENT_FILE_READ_FAILED',
      details: {
        errorCode: docxReviewPreviewSessionDetailString(error?.code),
      },
    };
  }

  const projectId = docxReviewPreviewSessionDetailString(binding.projectId);
  if (!projectId) {
    return {
      ok: false,
      code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: 'DOCX_REVIEW_PREVIEW_SESSION_PROJECT_ID_REQUIRED',
    };
  }

  const sceneId = getProjectRelativeFilePath(currentFilePath, binding.manifestPath)
    .replace(/\\/g, '/');
  if (!sceneId) {
    return {
      ok: false,
      code: 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      reason: 'DOCX_REVIEW_PREVIEW_SESSION_TARGET_SCOPE_UNAVAILABLE',
    };
  }

  const baselineHash = computeHash(content);
  return {
    ok: true,
    projectId,
    baselineHash,
    currentBaselineHash: baselineHash,
    targetScope: {
      type: 'scene',
      id: sceneId,
    },
    createdAt: new Date().toISOString(),
  };
}

function buildDocxReviewPreviewSessionImportPayload(context, candidate, requestId) {
  const sourceViewState = isPlainObjectValue(candidate.sourceViewState)
    ? cloneJsonSafe(candidate.sourceViewState)
    : {};
  const packetHash = docxReviewPreviewSessionDetailString(sourceViewState.packetHash)
    || computeHash(JSON.stringify(candidate.reviewPacket || {}));
  const sessionId = `docx-review-preview-${packetHash.slice(0, 16)}`;
  return {
    projectId: docxReviewPreviewSessionDetailString(context.projectId),
    sessionId,
    baselineHash: docxReviewPreviewSessionDetailString(context.baselineHash),
    currentBaselineHash: docxReviewPreviewSessionDetailString(context.currentBaselineHash),
    createdAt: docxReviewPreviewSessionDetailString(context.createdAt) || new Date().toISOString(),
    requestId,
    reviewPacket: cloneJsonSafe(candidate.reviewPacket) || {},
    sourceViewState: {
      ...sourceViewState,
      mode: docxReviewPreviewSessionDetailString(sourceViewState.mode) || 'docx-review-preview',
    },
    sourcePacketHash: packetHash,
  };
}

function summarizeDocxReviewPreviewSessionCandidate(candidate = {}) {
  const summary = isPlainObjectValue(candidate.summary) ? candidate.summary : {};
  const diagnosticFallbackCount = Array.isArray(candidate.diagnostics) ? candidate.diagnostics.length : 0;
  return {
    schemaVersion: docxReviewPreviewSessionDetailString(candidate.schemaVersion),
    status: docxReviewPreviewSessionDetailString(candidate.status),
    code: docxReviewPreviewSessionDetailString(candidate.code),
    reason: docxReviewPreviewSessionDetailString(candidate.reason),
    commentThreadCount: Number.isFinite(summary.commentThreadCount) ? summary.commentThreadCount : 0,
    commentPlacementCount: Number.isFinite(summary.commentPlacementCount) ? summary.commentPlacementCount : 0,
    diagnosticItemCount: Number.isFinite(summary.diagnosticItemCount)
      ? summary.diagnosticItemCount
      : diagnosticFallbackCount,
    canOpenReviewSession: candidate.canOpenReviewSession === true,
    canAutoApply: candidate.canAutoApply === true,
    canImportMutate: candidate.canImportMutate === true,
    canWriteStorage: candidate.canWriteStorage === true,
  };
}

function assertDocxReviewPreviewSessionActivationResult(result = {}) {
  if (
    Array.isArray(result.applyOps)
    || isPlainObjectValue(result.receipt)
    || isPlainObjectValue(result.recovery)
    || isPlainObjectValue(result.writeReceipt)
    || isPlainObjectValue(result.importReceipt)
    || result.canAutoApply !== false
    || result.canImportMutate !== false
    || result.canWriteStorage !== false
  ) {
    return makeDocxReviewPreviewSessionTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_FORBIDDEN_OUTPUT',
      'DOCX_REVIEW_PREVIEW_SESSION_FORBIDDEN_OUTPUT',
    );
  }
  return result;
}

async function handleDocxReviewPreviewSessionActivationCommandSurface(payload = {}, options = {}) {
  const decoded = decodeDocxIntakeGateBufferSource(payload);
  if (!decoded.ok) {
    return makeDocxReviewPreviewSessionTypedError(
      decoded.error?.code || 'E_DOCX_REVIEW_PREVIEW_SESSION_PAYLOAD_INVALID',
      decoded.error?.reason || 'DOCX_REVIEW_PREVIEW_SESSION_PAYLOAD_INVALID',
      decoded.error?.details,
    );
  }

  const context = await buildDocxReviewPreviewSessionMainContext(options);
  if (!context.ok) {
    return makeDocxReviewPreviewSessionTypedError(
      context.code || 'E_DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      context.reason || 'DOCX_REVIEW_PREVIEW_SESSION_CONTEXT_BLOCKED',
      context.details,
    );
  }

  let revisionBridge = null;
  try {
    revisionBridge = await loadRevisionBridgeModule();
  } catch (error) {
    return makeDocxReviewPreviewSessionTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_UNAVAILABLE',
      'DOCX_REVIEW_PREVIEW_SESSION_BRIDGE_UNAVAILABLE',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!revisionBridge || typeof revisionBridge.buildDocxReviewPreviewSessionCandidateFromZipBytes !== 'function') {
    return makeDocxReviewPreviewSessionTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_UNAVAILABLE',
      'DOCX_REVIEW_PREVIEW_SESSION_BUILDER_UNAVAILABLE',
    );
  }

  let candidate = null;
  try {
    candidate = revisionBridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(decoded.bytes, {
      targetScope: context.targetScope,
      createdAt: context.createdAt,
    });
  } catch (error) {
    return makeDocxReviewPreviewSessionTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_BUILD_FAILED',
      'DOCX_REVIEW_PREVIEW_SESSION_BUILD_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  const isReadyPreviewCandidate = isPlainObjectValue(candidate)
    && candidate.status === 'ready'
    && isPlainObjectValue(candidate.reviewPacket);
  const isDiagnosticEvidenceCandidate = isPlainObjectValue(candidate)
    && candidate.status === 'diagnostics'
    && isPlainObjectValue(candidate.reviewPacket)
    && Array.isArray(candidate.reviewPacket.diagnosticItems)
    && candidate.reviewPacket.diagnosticItems.length > 0;

  if (!isReadyPreviewCandidate && !isDiagnosticEvidenceCandidate) {
    return makeDocxReviewPreviewSessionTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_NO_CANDIDATE',
      docxReviewPreviewSessionDetailString(candidate?.reason) || 'DOCX_REVIEW_PREVIEW_SESSION_NO_CANDIDATE',
      {
        candidateSummary: summarizeDocxReviewPreviewSessionCandidate(candidate),
      },
    );
  }
  const hasForbiddenAuthority = candidate.canAutoApply !== false
    || candidate.canImportMutate !== false
    || candidate.canWriteStorage !== false
    || (isReadyPreviewCandidate && candidate.canOpenReviewSession !== true)
    || (isDiagnosticEvidenceCandidate && candidate.canOpenReviewSession !== false);
  if (hasForbiddenAuthority) {
    return makeDocxReviewPreviewSessionTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_FORBIDDEN_AUTHORITY',
      'DOCX_REVIEW_PREVIEW_SESSION_FORBIDDEN_AUTHORITY',
    );
  }

  const requestId = normalizeDocxIntakeGateRequestId(payload?.requestId);
  const importPayload = buildDocxReviewPreviewSessionImportPayload(context, candidate, requestId);
  const importResult = await handleReviewSurfaceImportPacketCommandSurface(importPayload);
  if (!importResult || importResult.ok !== true) {
    const nestedError = isPlainObjectValue(importResult?.error) ? importResult.error : {};
    return makeDocxReviewPreviewSessionTypedError(
      docxReviewPreviewSessionDetailString(nestedError.code) || 'E_DOCX_REVIEW_PREVIEW_SESSION_IMPORT_FAILED',
      docxReviewPreviewSessionDetailString(nestedError.reason) || 'DOCX_REVIEW_PREVIEW_SESSION_IMPORT_FAILED',
      isPlainObjectValue(nestedError.details) ? nestedError.details : undefined,
    );
  }

  return assertDocxReviewPreviewSessionActivationResult({
    ok: true,
    commandId: DOCX_REVIEW_PREVIEW_SESSION_COMMAND_ID,
    requestId,
    activated: true,
    diagnosticOnly: isDiagnosticEvidenceCandidate,
    session: importResult.session,
    reviewSurface: importResult.reviewSurface,
    candidateSummary: summarizeDocxReviewPreviewSessionCandidate(candidate),
    sourcePacketHash: importPayload.sourcePacketHash,
    canOpenReviewSession: candidate.canOpenReviewSession === true,
    canCreateReviewPacket: candidate.canCreateReviewPacket === true,
    canAutoApply: false,
    canImportMutate: false,
    canWriteStorage: false,
  });
}
// DOCX_REVIEW_PREVIEW_SESSION_COMMAND_SURFACE_END

// DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_SURFACE_START
const DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_ID = 'cmd.project.review.openDocxReviewPreviewSession';
const DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_ALLOWED_PAYLOAD_KEYS = new Set(['requestId']);
const DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_ALLOWED_SELECTION_KEYS = new Set([
  'path',
  'filePath',
  'name',
  'size',
  'requestId',
  'canceled',
]);

function sanitizeDocxReviewPreviewSessionLocalFileDetails(details) {
  if (!isPlainObjectValue(details)) return {};
  const result = {};
  if (Array.isArray(details.fields)) {
    result.fieldCount = details.fields.filter((item) => typeof item === 'string').length;
  }
  if (Number.isInteger(details.maxBytes)) result.maxBytes = details.maxBytes;
  if (Number.isInteger(details.actualBytes)) result.actualBytes = details.actualBytes;
  if (Number.isInteger(details.byteLength)) result.byteLength = details.byteLength;
  if (Number.isInteger(details.expectedBytes)) result.expectedBytes = details.expectedBytes;
  if (Number.isInteger(details.beforeBytes)) result.beforeBytes = details.beforeBytes;
  if (Number.isInteger(details.afterBytes)) result.afterBytes = details.afterBytes;
  if (typeof details.nestedCode === 'string' && details.nestedCode.trim()) {
    result.nestedCode = details.nestedCode.trim();
  }
  if (typeof details.nestedReason === 'string' && details.nestedReason.trim()) {
    result.nestedReason = details.nestedReason.trim();
  }
  if (isPlainObjectValue(details.candidateSummary)) {
    result.candidateSummary = cloneJsonSafe(details.candidateSummary);
  }
  return result;
}

function makeDocxReviewPreviewSessionLocalFileTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_ID,
    reason,
  };
  const safeDetails = sanitizeDocxReviewPreviewSessionLocalFileDetails(details);
  if (Object.keys(safeDetails).length > 0) {
    error.details = safeDetails;
  }
  return { ok: false, error };
}

function normalizeDocxReviewPreviewSessionLocalFileRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'docx-review-preview-session-local-file-request';
}

async function pickDocxReviewPreviewSessionLocalFile(options = {}) {
  const dialogResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Open DOCX Review',
    defaultPath: fileManager.getDocumentsPath(),
    filters: [{ name: 'DOCX', extensions: ['docx'] }],
    properties: ['openFile'],
  });

  if (!dialogResult || dialogResult.canceled === true) {
    return { canceled: true };
  }

  const filePath = Array.isArray(dialogResult.filePaths) && typeof dialogResult.filePaths[0] === 'string'
    ? dialogResult.filePaths[0].trim()
    : '';
  if (!filePath) {
    return {};
  }

  let size = null;
  try {
    const stat = await fs.stat(filePath);
    if (stat && typeof stat.isFile === 'function' && stat.isFile()) {
      size = Number.isFinite(stat.size) && stat.size >= 0 ? Math.floor(stat.size) : null;
    }
  } catch {}

  return {
    path: filePath,
    name: path.basename(filePath),
    size,
    requestId: normalizeDocxReviewPreviewSessionLocalFileRequestId(options.requestId),
  };
}

function validateDocxReviewPreviewSessionLocalFileSelection(selection, requestId) {
  if (!isPlainObjectValue(selection)) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID',
    );
  }

  const unsupportedKeys = Object.keys(selection)
    .filter((key) => !DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_ALLOWED_SELECTION_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_UNSUPPORTED_FIELDS',
      { fields: unsupportedKeys },
    );
  }

  const filePath = typeof selection.path === 'string' && selection.path.trim()
    ? selection.path.trim()
    : typeof selection.filePath === 'string' && selection.filePath.trim()
      ? selection.filePath.trim()
      : '';
  if (!filePath) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_FILE_REQUIRED',
    );
  }
  if (path.extname(filePath).toLowerCase() !== '.docx') {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_DOCX_REQUIRED',
    );
  }

  const size = Number.isFinite(selection.size) && selection.size >= 0
    ? Math.floor(selection.size)
    : null;
  if (size === null) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SIZE_REQUIRED',
    );
  }
  if (size > DOCX_INTAKE_GATE_MAX_BYTES) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE',
      {
        maxBytes: DOCX_INTAKE_GATE_MAX_BYTES,
        actualBytes: size,
      },
    );
  }

  return {
    ok: true,
    value: {
      path: filePath,
      name: typeof selection.name === 'string' && selection.name.trim()
        ? path.basename(selection.name.trim())
        : path.basename(filePath),
      size,
      requestId,
    },
  };
}

async function statDocxReviewPreviewSessionLocalFile(filePath) {
  const stat = await fs.stat(filePath);
  if (!stat || typeof stat.isFile !== 'function' || !stat.isFile()) {
    const error = new Error('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_FILE_REQUIRED');
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_FILE_REQUIRED';
    throw error;
  }
  const size = Number.isFinite(stat.size) && stat.size >= 0
    ? Math.floor(stat.size)
    : null;
  if (size === null) {
    const error = new Error('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SIZE_REQUIRED');
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SIZE_REQUIRED';
    throw error;
  }
  return size;
}

async function readDocxReviewPreviewSessionLocalFileBytes(selection) {
  if (!isPlainObjectValue(selection) || typeof selection.path !== 'string' || !selection.path.trim()) {
    throw new TypeError('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_SELECTION_INVALID');
  }
  const filePath = selection.path.trim();
  let beforeBytes;
  try {
    beforeBytes = await statDocxReviewPreviewSessionLocalFile(filePath);
  } catch (error) {
    error.code = typeof error?.code === 'string'
      ? error.code
      : 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_READ_FAILED';
    error.reason = typeof error?.reason === 'string'
      ? error.reason
      : 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_STAT_FAILED';
    throw error;
  }

  if (Number.isInteger(selection.size) && selection.size !== beforeBytes) {
    const error = new Error('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_CHANGED_DURING_READ');
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_CHANGED_DURING_READ';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_CHANGED_DURING_READ';
    error.details = {
      expectedBytes: selection.size,
      actualBytes: beforeBytes,
    };
    throw error;
  }
  if (beforeBytes > DOCX_INTAKE_GATE_MAX_BYTES) {
    const error = new Error('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE');
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE';
    error.details = {
      maxBytes: DOCX_INTAKE_GATE_MAX_BYTES,
      actualBytes: beforeBytes,
    };
    throw error;
  }

  let bytes;
  try {
    bytes = await fs.readFile(filePath);
  } catch (error) {
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_READ_FAILED';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_READ_FAILED';
    throw error;
  }

  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const afterBytes = await statDocxReviewPreviewSessionLocalFile(filePath);
  if (afterBytes !== beforeBytes || buffer.length !== afterBytes) {
    const error = new Error('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_CHANGED_DURING_READ');
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_CHANGED_DURING_READ';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_CHANGED_DURING_READ';
    error.details = {
      beforeBytes,
      afterBytes,
      byteLength: buffer.length,
    };
    throw error;
  }
  if (buffer.length === 0) {
    const error = new Error('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_BYTES_INVALID');
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_BYTES_INVALID';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_BYTES_EMPTY';
    throw error;
  }
  if (buffer.length > DOCX_INTAKE_GATE_MAX_BYTES) {
    const error = new Error('DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE');
    error.code = 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE';
    error.reason = 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE';
    error.details = {
      maxBytes: DOCX_INTAKE_GATE_MAX_BYTES,
      actualBytes: buffer.length,
    };
    throw error;
  }
  return buffer;
}

async function handleDocxReviewPreviewSessionLocalFileCommandSurface(payload = {}, options = {}) {
  const safePayload = isPlainObjectValue(payload) ? payload : {};
  const unsupportedPayloadKeys = Object.keys(safePayload)
    .filter((key) => !DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_ALLOWED_PAYLOAD_KEYS.has(key))
    .sort();
  if (unsupportedPayloadKeys.length > 0) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_PAYLOAD_INVALID',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_PAYLOAD_UNSUPPORTED_FIELDS',
      { fields: unsupportedPayloadKeys },
    );
  }

  const requestId = normalizeDocxReviewPreviewSessionLocalFileRequestId(safePayload.requestId);
  const pickLocalFile = typeof options.pickLocalFile === 'function'
    ? options.pickLocalFile
    : pickDocxReviewPreviewSessionLocalFile;
  const readLocalFileBytes = typeof options.readLocalFileBytes === 'function'
    ? options.readLocalFileBytes
    : readDocxReviewPreviewSessionLocalFileBytes;

  let selectedFile;
  try {
    selectedFile = await pickLocalFile({ requestId });
  } catch {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_PICK_FAILED',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_PICK_FAILED',
    );
  }

  if (selectedFile && selectedFile.canceled === true) {
    return {
      ok: true,
      commandId: DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_ID,
      requestId,
      activated: false,
      cancelled: true,
    };
  }

  const selection = validateDocxReviewPreviewSessionLocalFileSelection(selectedFile, requestId);
  if (!selection.ok) {
    return selection;
  }

  let bytes;
  try {
    bytes = await readLocalFileBytes(selection.value);
  } catch (error) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      typeof error?.code === 'string' && error.code
        ? error.code
        : 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_READ_FAILED',
      typeof error?.reason === 'string' && error.reason
        ? error.reason
        : 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_READ_FAILED',
      isPlainObjectValue(error?.details) ? error.details : undefined,
    );
  }

  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (buffer.length === 0) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_BYTES_INVALID',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_BYTES_EMPTY',
    );
  }
  if (buffer.length > DOCX_INTAKE_GATE_MAX_BYTES) {
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE',
      'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_TOO_LARGE',
      {
        maxBytes: DOCX_INTAKE_GATE_MAX_BYTES,
        actualBytes: buffer.length,
      },
    );
  }

  const activationResult = await handleDocxReviewPreviewSessionActivationCommandSurface({
    requestId,
    bufferSource: buffer.toString('base64'),
  }, options);
  if (!activationResult || activationResult.ok !== true) {
    const nestedError = isPlainObjectValue(activationResult?.error) ? activationResult.error : {};
    const nestedDetails = isPlainObjectValue(nestedError.details) ? nestedError.details : {};
    return makeDocxReviewPreviewSessionLocalFileTypedError(
      docxReviewPreviewSessionDetailString(nestedError.code)
        || 'E_DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_ACTIVATION_FAILED',
      docxReviewPreviewSessionDetailString(nestedError.reason)
        || 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_ACTIVATION_FAILED',
      {
        nestedCode: docxReviewPreviewSessionDetailString(nestedError.code),
        nestedReason: docxReviewPreviewSessionDetailString(nestedError.reason),
        candidateSummary: isPlainObjectValue(nestedDetails.candidateSummary)
          ? nestedDetails.candidateSummary
          : undefined,
      },
    );
  }

  return {
    ...activationResult,
    commandId: DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_ID,
    requestId,
    fileName: selection.value.name,
    byteLength: buffer.length,
  };
}
// DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_SURFACE_END

// DOCX_CONTENT_PREVIEW_COMMAND_SURFACE_START
const DOCX_CONTENT_PREVIEW_COMMAND_ID = 'cmd.project.docx.previewContent';
const DOCX_CONTENT_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
const DOCX_CONTENT_PREVIEW_MAX_BASE64_CHARS = Math.ceil(DOCX_CONTENT_PREVIEW_MAX_BYTES / 3) * 4;
const DOCX_CONTENT_PREVIEW_ALLOWED_PAYLOAD_KEYS = new Set(['requestId', 'bufferSource']);
const DOCX_CONTENT_PREVIEW_FORBIDDEN_RESULT_KEYS = new Set([
  ['review', 'Packet'].join(''),
  ['review', 'Surface'].join(''),
  ['parsed', 'Review', 'Surface'].join(''),
  ['active', 'Review', 'Session'].join(''),
  ['preview', 'Input'].join(''),
  ['apply', 'Ops'].join(''),
  ['apply', 'Plan'].join(''),
  ['can', 'Apply'].join(''),
  ['can', 'Create', 'Review', 'Packet'].join(''),
  ['can', 'Preview', 'Apply'].join(''),
  ['can', 'Import', 'Mutate'].join(''),
  ['can', 'Write', 'Storage'].join(''),
  ['write', 'Receipt'].join(''),
  ['import', 'Receipt'].join(''),
  ['export', 'Receipt'].join(''),
  ['raw', 'Bytes'].join(''),
  ['buffer', 'Source'].join(''),
  ['file', 'Path'].join(''),
  'bytes',
  'path',
  'inventory',
  'entries',
]);

function makeDocxContentPreviewTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_CONTENT_PREVIEW_COMMAND_ID,
    reason,
  };
  if (isPlainObjectValue(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
}

function normalizeDocxContentPreviewRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'docx-content-preview-request';
}

function decodeDocxContentPreviewBufferSource(payload = {}) {
  if (!isPlainObjectValue(payload)) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_CONTENT_PREVIEW_PAYLOAD_REQUIRED',
    );
  }

  const unsupportedKeys = Object.keys(payload)
    .filter((key) => !DOCX_CONTENT_PREVIEW_ALLOWED_PAYLOAD_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_CONTENT_PREVIEW_PAYLOAD_UNSUPPORTED_FIELDS',
      {
        fields: unsupportedKeys,
      },
    );
  }

  const bufferSource = typeof payload.bufferSource === 'string'
    ? payload.bufferSource.trim()
    : '';
  if (!bufferSource) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_REQUIRED',
    );
  }
  if (bufferSource.length > DOCX_CONTENT_PREVIEW_MAX_BASE64_CHARS) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_TOO_LARGE',
      'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_TOO_LARGE',
      {
        maxBytes: DOCX_CONTENT_PREVIEW_MAX_BYTES,
      },
    );
  }
  if (bufferSource.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(bufferSource)) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_BASE64_INVALID',
    );
  }

  const bytes = Buffer.from(bufferSource, 'base64');
  if (bytes.length === 0) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_EMPTY',
    );
  }
  if (bytes.length > DOCX_CONTENT_PREVIEW_MAX_BYTES) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_TOO_LARGE',
      'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_TOO_LARGE',
      {
        maxBytes: DOCX_CONTENT_PREVIEW_MAX_BYTES,
        byteLength: bytes.length,
      },
    );
  }
  if (bytes.toString('base64') !== bufferSource) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_BASE64_INVALID',
    );
  }

  return {
    ok: true,
    bytes,
  };
}

function findDocxContentPreviewForbiddenResultKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findDocxContentPreviewForbiddenResultKey(
        value[index],
        pathParts.concat(String(index)),
      );
      if (nested) return nested;
    }
    return '';
  }
  if (!isPlainObjectValue(value)) return '';

  for (const key of Object.keys(value)) {
    const keyPath = pathParts.concat(key).join('.');
    if (DOCX_CONTENT_PREVIEW_FORBIDDEN_RESULT_KEYS.has(key)) {
      return keyPath;
    }
    const nested = findDocxContentPreviewForbiddenResultKey(value[key], pathParts.concat(key));
    if (nested) return nested;
  }
  return '';
}

function buildDocxContentPreviewCommandResult(payload, previewResult) {
  const previewReport = cloneJsonSafe(previewResult);
  const previewOk = previewReport.ok === true;
  return {
    ok: true,
    requestId: normalizeDocxContentPreviewRequestId(payload?.requestId),
    commandId: DOCX_CONTENT_PREVIEW_COMMAND_ID,
    previewOk,
    previewStatus: typeof previewReport.status === 'string'
      ? previewReport.status
      : previewOk
        ? 'preview'
        : 'blocked',
    previewCode: typeof previewReport.code === 'string'
      ? previewReport.code
      : 'E_DOCX_CONTENT_PREVIEW_UNKNOWN',
    previewReason: typeof previewReport.reason === 'string'
      ? previewReport.reason
      : 'E_DOCX_CONTENT_PREVIEW_UNKNOWN',
    docxContentPreviewReport: previewReport,
  };
}

async function handleDocxContentPreviewCommandSurface(payload = {}) {
  const decoded = decodeDocxContentPreviewBufferSource(payload);
  if (!decoded.ok) return decoded;

  let revisionBridge = null;
  try {
    revisionBridge = await loadRevisionBridgeModule();
  } catch (error) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_UNAVAILABLE',
      'DOCX_CONTENT_PREVIEW_BRIDGE_UNAVAILABLE',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!revisionBridge || typeof revisionBridge.buildDocxContentPreviewFromZipBytes !== 'function') {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_UNAVAILABLE',
      'DOCX_CONTENT_PREVIEW_HELPER_UNAVAILABLE',
    );
  }

  let previewResult = null;
  try {
    previewResult = revisionBridge.buildDocxContentPreviewFromZipBytes(decoded.bytes);
  } catch (error) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_FAILED',
      'DOCX_CONTENT_PREVIEW_EXECUTION_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!isPlainObjectValue(previewResult)) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_INVALID_RESULT',
      'DOCX_CONTENT_PREVIEW_INVALID_RESULT',
    );
  }

  const forbiddenKey = findDocxContentPreviewForbiddenResultKey(previewResult);
  if (forbiddenKey) {
    return makeDocxContentPreviewTypedError(
      'E_DOCX_CONTENT_PREVIEW_FORBIDDEN_RESULT',
      'DOCX_CONTENT_PREVIEW_FORBIDDEN_RESULT',
      {
        key: forbiddenKey,
      },
    );
  }

  return buildDocxContentPreviewCommandResult(payload, previewResult);
}
// DOCX_CONTENT_PREVIEW_COMMAND_SURFACE_END

// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_START
const DOCX_IMPORT_PREVIEW_COMMAND_ID = 'cmd.project.docx.previewImportPlan';
const DOCX_IMPORT_PREVIEW_MAX_PAYLOAD_CHARS = 4 * 1024 * 1024;
const DOCX_IMPORT_PREVIEW_MAX_OBJECT_DEPTH = 32;
const DOCX_IMPORT_PREVIEW_MAX_REQUEST_ID_CHARS = 120;
const DOCX_IMPORT_PREVIEW_ALLOWED_PAYLOAD_KEYS = new Set(['requestId', 'docxContentPreviewReport']);
const DOCX_IMPORT_PREVIEW_SOURCE_REPORT_ALLOWED_KEYS = new Set([
  'ok',
  'schemaVersion',
  'type',
  'status',
  'code',
  'reason',
  'decision',
  'diagnostics',
  'evidence',
  'budgets',
  'preflightSummary',
  'contentPreview',
  'parse',
]);
const DOCX_IMPORT_PREVIEW_FORBIDDEN_PAYLOAD_KEYS = new Set([
  ['review', 'Packet'].join(''),
  ['review', 'Surface'].join(''),
  ['parsed', 'Review', 'Surface'].join(''),
  ['active', 'Review', 'Session'].join(''),
  ['preview', 'Input'].join(''),
  ['apply', 'Ops'].join(''),
  ['apply', 'Plan'].join(''),
  ['can', 'Apply'].join(''),
  ['can', 'Create', 'Review', 'Packet'].join(''),
  ['can', 'Preview', 'Apply'].join(''),
  ['can', 'Import', 'Mutate'].join(''),
  ['can', 'Write', 'Storage'].join(''),
  ['write', 'Effects'].join(''),
  ['write', 'Receipt'].join(''),
  ['import', 'Receipt'].join(''),
  ['export', 'Receipt'].join(''),
  ['safe', 'Create', 'Plan'].join(''),
  ['raw', 'Bytes'].join(''),
  ['buffer', 'Source'].join(''),
  ['file', 'Path'].join(''),
  ['project', 'Root'].join(''),
  ['package', 'Inspection'].join(''),
  ['part', 'Policy'].join(''),
  ['intake', 'Preflight', 'Report'].join(''),
  ['docx', 'Intake', 'Preflight', 'Report'].join(''),
  ['docx', 'Import', 'Preview', 'Plan'].join(''),
  ['out', 'Path'].join(''),
  ['out', 'Dir'].join(''),
  ['stor', 'age'].join(''),
  ['render', 'er'].join(''),
  ['pre', 'load'].join(''),
  ['pa', 'th'].join(''),
  'gate',
  'inventory',
  'entries',
  'bytes',
  'zip',
]);
const DOCX_IMPORT_PREVIEW_FORBIDDEN_RESULT_KEYS = new Set([
  ['review', 'Packet'].join(''),
  ['review', 'Surface'].join(''),
  ['parsed', 'Review', 'Surface'].join(''),
  ['active', 'Review', 'Session'].join(''),
  ['preview', 'Input'].join(''),
  ['apply', 'Ops'].join(''),
  ['apply', 'Plan'].join(''),
  ['can', 'Apply'].join(''),
  ['can', 'Create', 'Review', 'Packet'].join(''),
  ['can', 'Preview', 'Apply'].join(''),
  ['can', 'Import', 'Mutate'].join(''),
  ['can', 'Write', 'Storage'].join(''),
  ['write', 'Receipt'].join(''),
  ['import', 'Receipt'].join(''),
  ['export', 'Receipt'].join(''),
  ['safe', 'Create', 'Plan'].join(''),
  ['raw', 'Bytes'].join(''),
  ['buffer', 'Source'].join(''),
  ['file', 'Path'].join(''),
  ['project', 'Root'].join(''),
  ['package', 'Inspection'].join(''),
  ['part', 'Policy'].join(''),
  ['intake', 'Preflight', 'Report'].join(''),
  ['docx', 'Intake', 'Preflight', 'Report'].join(''),
  ['out', 'Path'].join(''),
  ['out', 'Dir'].join(''),
  ['stor', 'age'].join(''),
  ['render', 'er'].join(''),
  ['pre', 'load'].join(''),
  ['pa', 'th'].join(''),
]);

function makeDocxImportPreviewTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_IMPORT_PREVIEW_COMMAND_ID,
    reason,
  };
  if (isPlainObjectValue(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
}

function normalizeDocxImportPreviewRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'docx-import-preview-request';
}

function inspectDocxImportPreviewPayloadDepth(value, pathParts = [], seen = new WeakSet()) {
  if (!value || typeof value !== 'object') {
    return { ok: true };
  }
  if (pathParts.length > DOCX_IMPORT_PREVIEW_MAX_OBJECT_DEPTH) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_PREVIEW_PAYLOAD_DEPTH_EXCEEDED',
      details: {
        key: pathParts.join('.'),
        maxDepth: DOCX_IMPORT_PREVIEW_MAX_OBJECT_DEPTH,
      },
    };
  }
  if (seen.has(value)) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_PREVIEW_PAYLOAD_CIRCULAR',
      details: {
        key: pathParts.join('.'),
      },
    };
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = inspectDocxImportPreviewPayloadDepth(
        value[index],
        pathParts.concat(String(index)),
        seen,
      );
      if (!nested.ok) return nested;
    }
    seen.delete(value);
    return { ok: true };
  }

  if (!isPlainObjectValue(value)) {
    seen.delete(value);
    return { ok: true };
  }

  for (const key of Object.keys(value)) {
    const nested = inspectDocxImportPreviewPayloadDepth(value[key], pathParts.concat(key), seen);
    if (!nested.ok) return nested;
  }
  seen.delete(value);
  return { ok: true };
}

function measureDocxImportPreviewPayloadChars(payload) {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return -1;
  }
}

function findDocxImportPreviewForbiddenKey(value, forbiddenKeys, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findDocxImportPreviewForbiddenKey(
        value[index],
        forbiddenKeys,
        pathParts.concat(String(index)),
      );
      if (nested) return nested;
    }
    return '';
  }
  if (!isPlainObjectValue(value)) return '';

  for (const key of Object.keys(value)) {
    const keyPath = pathParts.concat(key).join('.');
    if (forbiddenKeys.has(key)) {
      return keyPath;
    }
    const nested = findDocxImportPreviewForbiddenKey(
      value[key],
      forbiddenKeys,
      pathParts.concat(key),
    );
    if (nested) return nested;
  }
  return '';
}

function copyDocxImportPreviewAllowedFields(source, allowedKeys) {
  if (!isPlainObjectValue(source)) return source;
  const result = {};
  for (const key of allowedKeys) {
    if (source[key] !== undefined) {
      result[key] = cloneJsonSafe(source[key]);
    }
  }
  return result;
}

function canonicalizeDocxImportPreviewDiagnostic(diagnostic) {
  return copyDocxImportPreviewAllowedFields(diagnostic, [
    'code',
    'severity',
    'message',
    'sourcePart',
    'sourceCode',
    'tagName',
    'actual',
    'limit',
  ]);
}

function canonicalizeDocxImportPreviewEvidence(evidence) {
  return copyDocxImportPreviewAllowedFields(evidence, [
    'kind',
    'sourceCode',
    'sourcePart',
    'byteSize',
    'compressedSize',
    'paragraphCount',
    'textLength',
    'textHash',
  ]);
}

function canonicalizeDocxImportPreviewSourceReport(sourceReport) {
  const contentPreview = isPlainObjectValue(sourceReport.contentPreview)
    ? {
        sourcePart: sourceReport.contentPreview.sourcePart,
        paragraphCount: sourceReport.contentPreview.paragraphCount,
        textLength: sourceReport.contentPreview.textLength,
        textHash: sourceReport.contentPreview.textHash,
        paragraphs: Array.isArray(sourceReport.contentPreview.paragraphs)
          ? sourceReport.contentPreview.paragraphs.map((paragraph) => (
              copyDocxImportPreviewAllowedFields(paragraph, [
                'order',
                'sourcePart',
                'text',
                'textHash',
                'charCount',
              ])
            ))
          : sourceReport.contentPreview.paragraphs,
      }
    : sourceReport.contentPreview;

  return {
    ok: sourceReport.ok,
    schemaVersion: sourceReport.schemaVersion,
    type: sourceReport.type,
    status: sourceReport.status,
    code: sourceReport.code,
    reason: sourceReport.reason,
    decision: sourceReport.decision,
    diagnostics: Array.isArray(sourceReport.diagnostics)
      ? sourceReport.diagnostics.map(canonicalizeDocxImportPreviewDiagnostic).filter(isPlainObjectValue)
      : sourceReport.diagnostics,
    evidence: Array.isArray(sourceReport.evidence)
      ? sourceReport.evidence.map(canonicalizeDocxImportPreviewEvidence).filter(isPlainObjectValue)
      : sourceReport.evidence,
    budgets: isPlainObjectValue(sourceReport.budgets)
      ? copyDocxImportPreviewAllowedFields(sourceReport.budgets, [
          'maxParagraphs',
          'maxTextChars',
          'maxDiagnostics',
        ])
      : sourceReport.budgets,
    preflightSummary: isPlainObjectValue(sourceReport.preflightSummary)
      ? copyDocxImportPreviewAllowedFields(sourceReport.preflightSummary, [
          'status',
          'decision',
          'code',
          'reason',
          'gatePass',
          'packageClassification',
          'partPolicyDecision',
          'parserCandidateOnly',
        ])
      : sourceReport.preflightSummary,
    contentPreview,
    parse: isPlainObjectValue(sourceReport.parse)
      ? copyDocxImportPreviewAllowedFields(sourceReport.parse, [
          'attempted',
          'completed',
        ])
      : sourceReport.parse,
  };
}

function validateDocxImportPreviewPayload(payload = {}) {
  if (!isPlainObjectValue(payload)) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_PAYLOAD_REQUIRED',
    );
  }

  const unsupportedKeys = Object.keys(payload)
    .filter((key) => !DOCX_IMPORT_PREVIEW_ALLOWED_PAYLOAD_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_PAYLOAD_UNSUPPORTED_FIELDS',
      {
        fields: unsupportedKeys,
      },
    );
  }

  if (
    payload.requestId !== undefined
    && typeof payload.requestId !== 'string'
  ) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_REQUEST_ID_INVALID',
    );
  }
  if (
    typeof payload.requestId === 'string'
    && payload.requestId.trim().length > DOCX_IMPORT_PREVIEW_MAX_REQUEST_ID_CHARS
  ) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_TOO_LARGE',
      'DOCX_IMPORT_PREVIEW_REQUEST_ID_TOO_LARGE',
      {
        maxChars: DOCX_IMPORT_PREVIEW_MAX_REQUEST_ID_CHARS,
      },
    );
  }

  if (!isPlainObjectValue(payload.docxContentPreviewReport)) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_SOURCE_REPORT_REQUIRED',
    );
  }
  if (payload.docxContentPreviewReport.schemaVersion !== 'revision-bridge.docx-content-preview.v1') {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_SOURCE_REPORT_SCHEMA_INVALID',
    );
  }
  if (payload.docxContentPreviewReport.type !== 'docxContentPreviewReport') {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_SOURCE_REPORT_TYPE_INVALID',
    );
  }

  const depthState = inspectDocxImportPreviewPayloadDepth(payload);
  if (!depthState.ok) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      depthState.reason,
      depthState.details,
    );
  }

  const payloadChars = measureDocxImportPreviewPayloadChars(payload);
  if (payloadChars < 0) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_PAYLOAD_NOT_SERIALIZABLE',
    );
  }
  if (payloadChars > DOCX_IMPORT_PREVIEW_MAX_PAYLOAD_CHARS) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_TOO_LARGE',
      'DOCX_IMPORT_PREVIEW_PAYLOAD_TOO_LARGE',
      {
        maxChars: DOCX_IMPORT_PREVIEW_MAX_PAYLOAD_CHARS,
        payloadChars,
      },
    );
  }

  const forbiddenKey = findDocxImportPreviewForbiddenKey(
    payload,
    DOCX_IMPORT_PREVIEW_FORBIDDEN_PAYLOAD_KEYS,
  );
  if (forbiddenKey) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_PAYLOAD_FORBIDDEN_FIELD',
      {
        key: forbiddenKey,
      },
    );
  }

  const unsupportedReportKeys = Object.keys(payload.docxContentPreviewReport)
    .filter((key) => !DOCX_IMPORT_PREVIEW_SOURCE_REPORT_ALLOWED_KEYS.has(key))
    .sort();
  if (unsupportedReportKeys.length > 0) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_PAYLOAD_INVALID',
      'DOCX_IMPORT_PREVIEW_SOURCE_REPORT_UNSUPPORTED_FIELDS',
      {
        fields: unsupportedReportKeys,
      },
    );
  }

  return {
    ok: true,
    docxContentPreviewReport: canonicalizeDocxImportPreviewSourceReport(
      payload.docxContentPreviewReport,
    ),
  };
}

function validateDocxImportPreviewCommandResultShape(importPreviewResult) {
  if (!isPlainObjectValue(importPreviewResult)) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_PREVIEW_INVALID_RESULT',
    };
  }
  if (importPreviewResult.writeEffects !== false) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_PREVIEW_WRITE_EFFECTS_INVALID',
    };
  }
  if (
    importPreviewResult.candidateCreatePlan !== null
    && importPreviewResult.candidateCreatePlan !== undefined
  ) {
    if (!isPlainObjectValue(importPreviewResult.candidateCreatePlan)) {
      return {
        ok: false,
        reason: 'DOCX_IMPORT_PREVIEW_CANDIDATE_PLAN_INVALID',
      };
    }
    if (importPreviewResult.candidateCreatePlan.mode !== 'create-only') {
      return {
        ok: false,
        reason: 'DOCX_IMPORT_PREVIEW_CANDIDATE_PLAN_MODE_INVALID',
      };
    }
  }
  return { ok: true };
}

function buildDocxImportPreviewCommandResult(payload, importPreviewResult) {
  const docxImportPreviewPlan = cloneJsonSafe(importPreviewResult);
  const importPreviewOk = docxImportPreviewPlan.ok === true;
  return {
    ok: true,
    requestId: normalizeDocxImportPreviewRequestId(payload?.requestId),
    commandId: DOCX_IMPORT_PREVIEW_COMMAND_ID,
    commandOk: true,
    importPreviewOk,
    importPreviewStatus: typeof docxImportPreviewPlan.status === 'string'
      ? docxImportPreviewPlan.status
      : importPreviewOk
        ? 'preview'
        : 'blocked',
    importPreviewCode: typeof docxImportPreviewPlan.code === 'string'
      ? docxImportPreviewPlan.code
      : 'E_DOCX_IMPORT_PREVIEW_UNKNOWN',
    importPreviewReason: typeof docxImportPreviewPlan.reason === 'string'
      ? docxImportPreviewPlan.reason
      : 'E_DOCX_IMPORT_PREVIEW_UNKNOWN',
    docxImportPreviewPlan,
  };
}

async function handleDocxImportPreviewCommandSurface(payload = {}) {
  const validated = validateDocxImportPreviewPayload(payload);
  if (!validated.ok) return validated;

  let revisionBridge = null;
  try {
    revisionBridge = await loadRevisionBridgeModule();
  } catch (error) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_UNAVAILABLE',
      'DOCX_IMPORT_PREVIEW_BRIDGE_UNAVAILABLE',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }
  if (!revisionBridge || typeof revisionBridge.buildDocxImportPreviewPlanFromContentPreview !== 'function') {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_UNAVAILABLE',
      'DOCX_IMPORT_PREVIEW_HELPER_UNAVAILABLE',
    );
  }

  let importPreviewResult = null;
  try {
    importPreviewResult = revisionBridge.buildDocxImportPreviewPlanFromContentPreview(
      validated.docxContentPreviewReport,
    );
  } catch (error) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_FAILED',
      'DOCX_IMPORT_PREVIEW_EXECUTION_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  const resultShape = validateDocxImportPreviewCommandResultShape(importPreviewResult);
  if (!resultShape.ok) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_INVALID_RESULT',
      resultShape.reason,
    );
  }

  const forbiddenKey = findDocxImportPreviewForbiddenKey(
    importPreviewResult,
    DOCX_IMPORT_PREVIEW_FORBIDDEN_RESULT_KEYS,
  );
  if (forbiddenKey) {
    return makeDocxImportPreviewTypedError(
      'E_DOCX_IMPORT_PREVIEW_FORBIDDEN_RESULT',
      'DOCX_IMPORT_PREVIEW_FORBIDDEN_RESULT',
      {
        key: forbiddenKey,
      },
    );
  }

  if (importPreviewResult.ok === true && typeof rememberDocxImportPreviewPlanAdmission === 'function') {
    rememberDocxImportPreviewPlanAdmission(importPreviewResult);
  }
  return buildDocxImportPreviewCommandResult(payload, importPreviewResult);
}
// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_END

// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_START
const DOCX_IMPORT_SAFE_CREATE_COMMAND_ID = 'cmd.project.docx.importSafeCreate';
const DOCX_IMPORT_SAFE_CREATE_MAX_PAYLOAD_CHARS = 4 * 1024 * 1024;
const DOCX_IMPORT_SAFE_CREATE_MAX_OBJECT_DEPTH = 32;
const DOCX_IMPORT_SAFE_CREATE_MAX_REQUEST_ID_CHARS = 120;
const DOCX_IMPORT_SAFE_CREATE_MESSAGE_CODE_RE = /^(DOCX|FLOW)_[A-Z0-9_]{1,95}$/u;
const DOCX_IMPORT_SAFE_CREATE_ALLOWED_PAYLOAD_KEYS = new Set(['requestId', 'docxImportPreviewPlan']);
const DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_PAYLOAD_KEYS = new Set([
  ['review', 'Packet'].join(''),
  ['review', 'Surface'].join(''),
  ['parsed', 'Review', 'Surface'].join(''),
  ['active', 'Review', 'Session'].join(''),
  ['preview', 'Input'].join(''),
  ['apply', 'Ops'].join(''),
  ['apply', 'Plan'].join(''),
  ['can', 'Apply'].join(''),
  ['can', 'Create', 'Review', 'Packet'].join(''),
  ['can', 'Preview', 'Apply'].join(''),
  ['can', 'Import', 'Mutate'].join(''),
  ['can', 'Write', 'Storage'].join(''),
  ['write', 'Receipt'].join(''),
  ['import', 'Receipt'].join(''),
  ['export', 'Receipt'].join(''),
  ['safe', 'Create', 'Plan'].join(''),
  ['raw', 'Bytes'].join(''),
  ['buffer', 'Source'].join(''),
  ['file', 'Path'].join(''),
  ['project', 'Root'].join(''),
  ['package', 'Inspection'].join(''),
  ['part', 'Policy'].join(''),
  ['intake', 'Preflight', 'Report'].join(''),
  ['docx', 'Intake', 'Preflight', 'Report'].join(''),
  ['out', 'Path'].join(''),
  ['out', 'Dir'].join(''),
  ['stor', 'age'].join(''),
  ['render', 'er'].join(''),
  ['pre', 'load'].join(''),
  ['pa', 'th'].join(''),
  'gate',
  'inventory',
  'bytes',
  'zip',
]);
const DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_RESULT_KEYS = new Set([
  ['review', 'Packet'].join(''),
  ['review', 'Surface'].join(''),
  ['parsed', 'Review', 'Surface'].join(''),
  ['active', 'Review', 'Session'].join(''),
  ['preview', 'Input'].join(''),
  ['apply', 'Ops'].join(''),
  ['apply', 'Plan'].join(''),
  ['can', 'Apply'].join(''),
  ['can', 'Create', 'Review', 'Packet'].join(''),
  ['can', 'Preview', 'Apply'].join(''),
  ['can', 'Import', 'Mutate'].join(''),
  ['can', 'Write', 'Storage'].join(''),
  ['write', 'Receipt'].join(''),
  ['import', 'Receipt'].join(''),
  ['export', 'Receipt'].join(''),
  ['safe', 'Create', 'Plan'].join(''),
  ['raw', 'Bytes'].join(''),
  ['buffer', 'Source'].join(''),
  ['file', 'Path'].join(''),
  ['project', 'Root'].join(''),
  ['package', 'Inspection'].join(''),
  ['part', 'Policy'].join(''),
  ['intake', 'Preflight', 'Report'].join(''),
  ['docx', 'Intake', 'Preflight', 'Report'].join(''),
  ['out', 'Path'].join(''),
  ['out', 'Dir'].join(''),
  ['stor', 'age'].join(''),
  ['render', 'er'].join(''),
  ['pre', 'load'].join(''),
  ['pa', 'th'].join(''),
]);

function makeDocxImportSafeCreateTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_IMPORT_SAFE_CREATE_COMMAND_ID,
    reason,
  };
  const safeDetails = sanitizeDocxImportSafeCreateErrorDetails(details);
  if (Object.keys(safeDetails).length > 0) {
    error.details = safeDetails;
  }
  return { ok: false, error };
}

function sanitizeDocxImportSafeCreateErrorDetails(details) {
  if (!isPlainObjectValue(details)) return {};
  const result = {};
  if (typeof details.field === 'string') result.field = details.field;
  if (Array.isArray(details.fields)) {
    result.fields = details.fields.filter((item) => typeof item === 'string');
  }
  if (typeof details.key === 'string') result.key = details.key;
  if (Number.isInteger(details.index)) result.index = details.index;
  if (typeof details.sceneId === 'string') result.sceneId = details.sceneId;
  if (Number.isInteger(details.maxChars)) result.maxChars = details.maxChars;
  if (Number.isInteger(details.payloadChars)) result.payloadChars = details.payloadChars;
  if (typeof details.expected === 'string' && /^[a-f0-9]{8,64}$/u.test(details.expected)) {
    result.expected = details.expected;
  }
  if (typeof details.failReason === 'string') result.failReason = details.failReason;
  if (typeof details.batchId === 'string') result.batchId = details.batchId;
  if (Array.isArray(details.staleMarkers)) {
    result.staleMarkerCount = details.staleMarkers.length;
  }
  if (
    typeof details.messageCode === 'string'
    && (
      details.messageCode === 'WRITE_EXCEPTION'
      || details.messageCode === 'UNKNOWN'
      || DOCX_IMPORT_SAFE_CREATE_MESSAGE_CODE_RE.test(details.messageCode)
    )
  ) {
    result.messageCode = details.messageCode;
  }
  return result;
}

function normalizeDocxImportSafeCreateRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'docx-import-safe-create-request';
}

function inspectDocxImportSafeCreatePayloadDepth(value, pathParts = [], seen = new WeakSet()) {
  if (!value || typeof value !== 'object') {
    return { ok: true };
  }
  if (pathParts.length > DOCX_IMPORT_SAFE_CREATE_MAX_OBJECT_DEPTH) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_DEPTH_EXCEEDED',
      details: {
        key: pathParts.join('.'),
        maxDepth: DOCX_IMPORT_SAFE_CREATE_MAX_OBJECT_DEPTH,
      },
    };
  }
  if (seen.has(value)) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_CIRCULAR',
      details: {
        key: pathParts.join('.'),
      },
    };
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = inspectDocxImportSafeCreatePayloadDepth(
        value[index],
        pathParts.concat(String(index)),
        seen,
      );
      if (!nested.ok) return nested;
    }
    seen.delete(value);
    return { ok: true };
  }

  if (!isPlainObjectValue(value)) {
    seen.delete(value);
    return { ok: true };
  }

  for (const key of Object.keys(value)) {
    const nested = inspectDocxImportSafeCreatePayloadDepth(value[key], pathParts.concat(key), seen);
    if (!nested.ok) return nested;
  }
  seen.delete(value);
  return { ok: true };
}

function measureDocxImportSafeCreatePayloadChars(payload) {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return -1;
  }
}

function findDocxImportSafeCreateForbiddenKey(value, forbiddenKeys, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findDocxImportSafeCreateForbiddenKey(
        value[index],
        forbiddenKeys,
        pathParts.concat(String(index)),
      );
      if (nested) return nested;
    }
    return '';
  }
  if (!isPlainObjectValue(value)) return '';

  for (const key of Object.keys(value)) {
    const keyPath = pathParts.concat(key).join('.');
    const allowedPlanWriteEffects = pathParts.length === 1
      && pathParts[0] === 'docxImportPreviewPlan'
      && key === 'writeEffects';
    if (!allowedPlanWriteEffects && forbiddenKeys.has(key)) {
      return keyPath;
    }
    const nested = findDocxImportSafeCreateForbiddenKey(
      value[key],
      forbiddenKeys,
      pathParts.concat(key),
    );
    if (nested) return nested;
  }
  return '';
}

function validateDocxImportSafeCreatePayload(payload = {}) {
  if (!isPlainObjectValue(payload)) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_REQUIRED',
    );
  }

  const unsupportedKeys = Object.keys(payload)
    .filter((key) => !DOCX_IMPORT_SAFE_CREATE_ALLOWED_PAYLOAD_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_UNSUPPORTED_FIELDS',
      {
        fields: unsupportedKeys,
      },
    );
  }

  if (
    payload.requestId !== undefined
    && typeof payload.requestId !== 'string'
  ) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_REQUEST_ID_INVALID',
    );
  }
  if (
    typeof payload.requestId === 'string'
    && payload.requestId.trim().length > DOCX_IMPORT_SAFE_CREATE_MAX_REQUEST_ID_CHARS
  ) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_TOO_LARGE',
      'DOCX_IMPORT_SAFE_CREATE_REQUEST_ID_TOO_LARGE',
      {
        maxChars: DOCX_IMPORT_SAFE_CREATE_MAX_REQUEST_ID_CHARS,
      },
    );
  }

  if (!isPlainObjectValue(payload.docxImportPreviewPlan)) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_PREVIEW_PLAN_REQUIRED',
    );
  }
  if (payload.docxImportPreviewPlan.schemaVersion !== 'revision-bridge.docx-import-preview.v1') {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_PREVIEW_PLAN_SCHEMA_INVALID',
    );
  }
  if (payload.docxImportPreviewPlan.type !== 'docx.import.preview') {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_PREVIEW_PLAN_TYPE_INVALID',
    );
  }

  const depthState = inspectDocxImportSafeCreatePayloadDepth(payload);
  if (!depthState.ok) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      depthState.reason,
      depthState.details,
    );
  }

  const payloadChars = measureDocxImportSafeCreatePayloadChars(payload);
  if (payloadChars < 0) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_NOT_SERIALIZABLE',
    );
  }
  if (payloadChars > DOCX_IMPORT_SAFE_CREATE_MAX_PAYLOAD_CHARS) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_TOO_LARGE',
      'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_TOO_LARGE',
      {
        maxChars: DOCX_IMPORT_SAFE_CREATE_MAX_PAYLOAD_CHARS,
        payloadChars,
      },
    );
  }

  const forbiddenKey = findDocxImportSafeCreateForbiddenKey(
    payload,
    DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_PAYLOAD_KEYS,
  );
  if (forbiddenKey) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PAYLOAD_INVALID',
      'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_FORBIDDEN_FIELD',
      {
        key: forbiddenKey,
      },
    );
  }
  if (
    typeof isDocxImportPreviewPlanAdmitted !== 'function'
    || !isDocxImportPreviewPlanAdmitted(payload.docxImportPreviewPlan)
  ) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_PREVIEW_NOT_ADMITTED',
      'DOCX_IMPORT_SAFE_CREATE_PREVIEW_NOT_ADMITTED',
    );
  }

  return {
    ok: true,
    docxImportPreviewPlan: cloneJsonSafe(payload.docxImportPreviewPlan),
  };
}

function buildDocxImportSafeCreateCommandResult(payload, safeCreateResult) {
  const receipt = cloneJsonSafe(safeCreateResult.value.receipt);
  return {
    ok: true,
    requestId: normalizeDocxImportSafeCreateRequestId(payload?.requestId),
    commandId: DOCX_IMPORT_SAFE_CREATE_COMMAND_ID,
    commandOk: true,
    safeCreateOk: true,
    created: true,
    createdSceneIds: Array.isArray(safeCreateResult.value.createdSceneIds)
      ? cloneJsonSafe(safeCreateResult.value.createdSceneIds)
      : [],
    receipt,
  };
}

function validateDocxImportSafeCreateCommandResult(result) {
  if (!isPlainObjectValue(result)) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_SAFE_CREATE_INVALID_RESULT',
    };
  }
  if (result.ok !== true || result.created !== true || !Array.isArray(result.createdSceneIds)) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_SAFE_CREATE_RESULT_SHAPE_INVALID',
    };
  }
  const forbiddenKey = findDocxImportSafeCreateForbiddenKey(
    result,
    DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_RESULT_KEYS,
  );
  if (forbiddenKey) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_RESULT',
      key: forbiddenKey,
    };
  }
  return { ok: true };
}

async function handleDocxImportSafeCreateCommandSurface(payload = {}) {
  const validated = validateDocxImportSafeCreatePayload(payload);
  if (!validated.ok) return validated;
  if (typeof applyDocxImportSafeCreate !== 'function') {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_UNAVAILABLE',
      'DOCX_IMPORT_SAFE_CREATE_HELPER_UNAVAILABLE',
    );
  }

  let safeCreateResult = null;
  try {
    await ensureProjectStructure();
    const romanRoot = getProjectSectionPath('roman');
    const projectBinding = await resolveProjectBindingForFile(romanRoot);
    safeCreateResult = await applyDocxImportSafeCreate(
      {
        docxImportPreviewPlan: validated.docxImportPreviewPlan,
      },
      {
        projectRoot: getProjectRootPath(),
        romanRoot,
        projectId: projectBinding && typeof projectBinding.projectId === 'string'
          ? projectBinding.projectId
          : '',
        queueDiskOperation,
        operationLabel: 'safe create DOCX import scene batch',
        writeBatchAtomic: writeFlowSceneBatchAtomic,
      },
    );
  } catch (error) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_FAILED',
      'DOCX_IMPORT_SAFE_CREATE_EXECUTION_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!safeCreateResult || safeCreateResult.ok !== true) {
    return makeDocxImportSafeCreateTypedError(
      safeCreateResult && safeCreateResult.error && typeof safeCreateResult.error.code === 'string'
        ? safeCreateResult.error.code
        : 'E_DOCX_IMPORT_SAFE_CREATE_FAILED',
      safeCreateResult && safeCreateResult.error && typeof safeCreateResult.error.reason === 'string'
        ? safeCreateResult.error.reason
        : 'DOCX_IMPORT_SAFE_CREATE_FAILED',
      safeCreateResult && safeCreateResult.error && isPlainObjectValue(safeCreateResult.error.details)
        ? safeCreateResult.error.details
        : {},
    );
  }

  const commandResult = buildDocxImportSafeCreateCommandResult(payload, safeCreateResult);
  const resultShape = validateDocxImportSafeCreateCommandResult(commandResult);
  if (!resultShape.ok) {
    return makeDocxImportSafeCreateTypedError(
      'E_DOCX_IMPORT_SAFE_CREATE_INVALID_RESULT',
      resultShape.reason,
      resultShape.key ? { key: resultShape.key } : {},
    );
  }
  return commandResult;
}
// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_END

// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_START
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID = 'cmd.project.docx.previewLocalFile';
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT_KEYS = new Set([
  ['review', 'Packet'].join(''),
  ['review', 'Surface'].join(''),
  ['parsed', 'Review', 'Surface'].join(''),
  ['active', 'Review', 'Session'].join(''),
  ['preview', 'Input'].join(''),
  ['apply', 'Ops'].join(''),
  ['apply', 'Plan'].join(''),
  ['can', 'Apply'].join(''),
  ['can', 'Create', 'Review', 'Packet'].join(''),
  ['can', 'Preview', 'Apply'].join(''),
  ['can', 'Import', 'Mutate'].join(''),
  ['can', 'Write', 'Storage'].join(''),
  ['write', 'Receipt'].join(''),
  ['import', 'Receipt'].join(''),
  ['export', 'Receipt'].join(''),
  ['safe', 'Create', 'Plan'].join(''),
  ['raw', 'Bytes'].join(''),
  ['buffer', 'Source'].join(''),
  ['file', 'Path'].join(''),
  ['project', 'Root'].join(''),
  ['package', 'Inspection'].join(''),
  ['part', 'Policy'].join(''),
  ['intake', 'Preflight', 'Report'].join(''),
  ['docx', 'Intake', 'Preflight', 'Report'].join(''),
  ['out', 'Path'].join(''),
  ['out', 'Dir'].join(''),
  ['stor', 'age'].join(''),
  ['render', 'er'].join(''),
  ['pre', 'load'].join(''),
  ['pa', 'th'].join(''),
  ['byt', 'es'].join(''),
  'inventory',
  'zip',
  'receipt',
]);
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_ALLOWED_RESULT_KEYS = new Set([
  'ok',
  'requestId',
  'schemaVersion',
  'type',
  'status',
  'code',
  'reason',
  'decision',
  'writeEffects',
  'contentPreviewOk',
  'importPreviewOk',
  'docxContentPreviewReport',
  'docxImportPreviewPlan',
]);

function makeDocxImportLocalFilePreviewTypedError(code, reason, details = undefined) {
  const error = {
    code,
    op: DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID,
    reason,
  };
  const safeDetails = sanitizeDocxImportLocalFilePreviewErrorDetails(details);
  if (Object.keys(safeDetails).length > 0) {
    error.details = safeDetails;
  }
  return { ok: false, error };
}

function sanitizeDocxImportLocalFilePreviewErrorDetails(details) {
  if (!isPlainObjectValue(details)) return {};
  const result = {};
  if (
    typeof details.field === 'string'
    && !DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT_KEYS.has(details.field)
  ) {
    result.field = details.field;
  }
  if (Array.isArray(details.fields)) {
    result.fieldCount = details.fields.filter((item) => typeof item === 'string').length;
  }
  if (typeof details.key === 'string') result.key = details.key;
  if (Number.isInteger(details.maxBytes)) result.maxBytes = details.maxBytes;
  if (Number.isInteger(details.byteLength)) result.byteLength = details.byteLength;
  if (Number.isInteger(details.maxChars)) result.maxChars = details.maxChars;
  if (Number.isInteger(details.payloadChars)) result.payloadChars = details.payloadChars;
  return result;
}

function normalizeDocxImportLocalFilePreviewRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'docx-import-local-file-preview-request';
}

function findDocxImportLocalFilePreviewForbiddenKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findDocxImportLocalFilePreviewForbiddenKey(
        value[index],
        pathParts.concat(String(index)),
      );
      if (nested) return nested;
    }
    return '';
  }
  if (!isPlainObjectValue(value)) return '';

  for (const key of Object.keys(value)) {
    const keyPath = pathParts.concat(key).join('.');
    if (DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT_KEYS.has(key)) {
      return keyPath;
    }
    const nested = findDocxImportLocalFilePreviewForbiddenKey(
      value[key],
      pathParts.concat(key),
    );
    if (nested) return nested;
  }
  return '';
}

async function pickDocxImportLocalFilePreviewFile(options = {}) {
  const dialogResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Импорт DOCX',
    defaultPath: fileManager.getDocumentsPath(),
    filters: [{ name: 'DOCX', extensions: ['docx'] }],
    properties: ['openFile'],
  });

  if (!dialogResult || dialogResult.canceled === true) {
    return { canceled: true };
  }

  const filePath = Array.isArray(dialogResult.filePaths) && typeof dialogResult.filePaths[0] === 'string'
    ? dialogResult.filePaths[0].trim()
    : '';
  if (!filePath) {
    return {};
  }

  let size = null;
  try {
    const stat = await fs.stat(filePath);
    if (stat && typeof stat.isFile === 'function' && stat.isFile()) {
      size = Number.isFinite(stat.size) && stat.size >= 0 ? Math.floor(stat.size) : null;
    }
  } catch {}

  return {
    path: filePath,
    name: path.basename(filePath),
    size,
    requestId: normalizeDocxImportLocalFilePreviewRequestId(options.requestId),
  };
}

async function readDocxImportLocalFilePreviewBytes(selection) {
  if (!isPlainObjectValue(selection)) {
    throw new TypeError('DOCX_IMPORT_LOCAL_FILE_PREVIEW_SELECTION_INVALID');
  }

  const filePath = typeof selection.path === 'string' && selection.path.trim()
    ? selection.path.trim()
    : typeof selection.filePath === 'string' && selection.filePath.trim()
      ? selection.filePath.trim()
      : '';
  if (!filePath) {
    throw new TypeError('DOCX_IMPORT_LOCAL_FILE_PREVIEW_SELECTION_INVALID');
  }

  return fs.readFile(filePath);
}

function validateDocxImportLocalFilePreviewSuccessResult(previewResult) {
  if (!isPlainObjectValue(previewResult)) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_INVALID_RESULT',
    };
  }

  const unsupportedKeys = Object.keys(previewResult)
    .filter((key) => !DOCX_IMPORT_LOCAL_FILE_PREVIEW_ALLOWED_RESULT_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_RESULT_UNSUPPORTED_FIELDS',
      details: {
        fields: unsupportedKeys,
      },
    };
  }

  if (previewResult.schemaVersion !== 'revision-bridge.docx-import-local-file-preview.v1') {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA_INVALID',
    };
  }
  if (previewResult.type !== 'docx.import.localFilePreview') {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_TYPE_INVALID',
    };
  }
  if (previewResult.writeEffects !== false) {
    return {
      ok: false,
      reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_WRITE_EFFECTS_INVALID',
    };
  }

  return { ok: true };
}

function buildDocxImportLocalFilePreviewCommandResult(previewResult) {
  const localPreview = cloneJsonSafe(previewResult);
  return {
    ok: true,
    requestId: normalizeDocxImportLocalFilePreviewRequestId(localPreview.requestId),
    commandId: DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID,
    commandOk: true,
    schemaVersion: localPreview.schemaVersion,
    type: localPreview.type,
    status: localPreview.status,
    code: localPreview.code,
    reason: localPreview.reason,
    decision: localPreview.decision,
    writeEffects: localPreview.writeEffects,
    contentPreviewOk: localPreview.contentPreviewOk === true,
    importPreviewOk: localPreview.importPreviewOk === true,
    docxContentPreviewReport: localPreview.docxContentPreviewReport,
    docxImportPreviewPlan: localPreview.docxImportPreviewPlan ?? null,
  };
}

async function handleDocxImportLocalFilePreviewCommandSurface(payload = {}) {
  if (typeof createDocxImportLocalFilePreview !== 'function') {
    return makeDocxImportLocalFilePreviewTypedError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_UNAVAILABLE',
      'DOCX_IMPORT_LOCAL_FILE_PREVIEW_HELPER_UNAVAILABLE',
    );
  }

  let previewResult = null;
  try {
    previewResult = await createDocxImportLocalFilePreview(payload, {
      pickLocalFile: pickDocxImportLocalFilePreviewFile,
      readLocalFileBytes: readDocxImportLocalFilePreviewBytes,
      maxBytes: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    });
  } catch (error) {
    return makeDocxImportLocalFilePreviewTypedError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_FAILED',
      'DOCX_IMPORT_LOCAL_FILE_PREVIEW_EXECUTION_FAILED',
      {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    );
  }

  if (!isPlainObjectValue(previewResult)) {
    return makeDocxImportLocalFilePreviewTypedError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INVALID_RESULT',
      'DOCX_IMPORT_LOCAL_FILE_PREVIEW_INVALID_RESULT',
    );
  }

  if (previewResult.ok !== true) {
    const forbiddenErrorKey = findDocxImportLocalFilePreviewForbiddenKey(previewResult.error);
    if (forbiddenErrorKey) {
      return makeDocxImportLocalFilePreviewTypedError(
        'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INVALID_RESULT',
        'DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT',
        {
          key: `error.${forbiddenErrorKey}`,
        },
      );
    }

    const error = isPlainObjectValue(previewResult.error) ? previewResult.error : {};
    return makeDocxImportLocalFilePreviewTypedError(
      typeof error.code === 'string' && error.code
        ? error.code
        : 'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_FAILED',
      typeof error.reason === 'string' && error.reason
        ? error.reason
        : 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_FAILED',
      isPlainObjectValue(error.details) ? error.details : undefined,
    );
  }

  const resultShape = validateDocxImportLocalFilePreviewSuccessResult(previewResult);
  if (!resultShape.ok) {
    return makeDocxImportLocalFilePreviewTypedError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INVALID_RESULT',
      resultShape.reason,
      resultShape.details,
    );
  }

  const forbiddenKey = findDocxImportLocalFilePreviewForbiddenKey(previewResult);
  if (forbiddenKey) {
    return makeDocxImportLocalFilePreviewTypedError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INVALID_RESULT',
      'DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT',
      {
        key: forbiddenKey,
      },
    );
  }

  return buildDocxImportLocalFilePreviewCommandResult(previewResult);
}
// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_END

// CONTOUR_12L_COMMAND_SURFACE_RELEASE_CLAIM_ADMISSION_START
function isReleaseClaimCommandSurfacePlainPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) return true;
  const parentPrototype = Object.getPrototypeOf(prototype);
  return parentPrototype === null
    && Object.prototype.hasOwnProperty.call(prototype, 'constructor')
    && prototype.constructor
    && prototype.constructor.name === 'Object';
}

function makeReleaseClaimCommandSurfaceAdmissionError(code, reason, details = undefined) {
  const error = {
    code,
    op: 'cmd.project.releaseClaim.admit',
    reason,
  };
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = { ...details };
  }
  return { ok: false, error };
}

async function handleRevisionBridgeReleaseClaimCommandSurfaceAdmission(payload = {}) {
  if (!isReleaseClaimCommandSurfacePlainPayload(payload)) {
    return makeReleaseClaimCommandSurfaceAdmissionError(
      'E_RELEASE_CLAIM_COMMAND_SURFACE_ADMISSION_PAYLOAD_INVALID',
      'PAYLOAD_PLAIN_OBJECT_REQUIRED',
      {
        receivedType: Array.isArray(payload) ? 'array' : typeof payload,
      },
    );
  }

  const revisionBridge = await loadRevisionBridgeModule();
  return revisionBridge.evaluateRevisionBridgeReleaseClaimExecutionGate(payload);
}
// CONTOUR_12L_COMMAND_SURFACE_RELEASE_CLAIM_ADMISSION_END

function getInternalCommandSurfaceKernel() {
  if (internalCommandSurfaceKernel) {
    return internalCommandSurfaceKernel;
  }
  internalCommandSurfaceKernel = createCommandSurfaceKernel({
    [COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_OPEN]: async () => {
      await ensureCleanAction(handleOpen);
      return { ok: true };
    },
    [COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_SAVE]: async () => {
      const saved = await handleSave();
      return { ok: saved === true };
    },
    [COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_SAVE_AS]: async () => {
      const savedAs = await handleSaveAs();
      return { ok: savedAs === true };
    },
    [COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1]: async (payload = {}) => {
      return handleImportMarkdownV1(payload);
    },
    [COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1]: async (payload = {}) => {
      return handleExportMarkdownV1(payload);
    },
    [COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_RELEASE_CLAIM_ADMIT]: async (payload = {}) => {
      return handleRevisionBridgeReleaseClaimCommandSurfaceAdmission(payload);
    },
  });
  return internalCommandSurfaceKernel;
}

function dispatchCommandSurfaceKernel(commandId, payload = {}) {
  return getInternalCommandSurfaceKernel().dispatch(commandId, payload);
}

function sanitizeFilename(name) {
  const safe = String(name || '')
    .trim()
    .replace(/[\\/<>:"|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '');

  return safe.slice(0, 80) || 'Untitled';
}

const ROMAN_SECTION_FILENAME_SET = new Set(
  ROMAN_SECTION_LABELS.map((label) => sanitizeFilename(label).toLowerCase())
);

function getProjectRootPath(projectName = DEFAULT_PROJECT_NAME) {
  const root = fileManager.getDocumentsPath();
  return joinPathSegmentsWithinRoot(root, [sanitizeFilename(projectName)], { resolveSymlinks: false });
}

function getProjectSectionPath(section, projectName = DEFAULT_PROJECT_NAME) {
  const root = getProjectRootPath(projectName);
  const folder = PROJECT_SUBFOLDERS[section];
  return folder ? joinPathSegmentsWithinRoot(root, [folder], { resolveSymlinks: false }) : root;
}

function getProjectManifestPath(projectName = DEFAULT_PROJECT_NAME) {
  return joinPathSegmentsWithinRoot(getProjectRootPath(projectName), [PROJECT_MANIFEST_FILENAME], {
    resolveSymlinks: false,
  });
}

function buildSectionDefinitions(labels) {
  return labels.map((label) => ({
    label,
    dirName: sanitizeFilename(label)
  }));
}

const MATERIALS_SECTIONS = buildSectionDefinitions(MATERIALS_SECTION_LABELS);
const REFERENCE_SECTIONS = buildSectionDefinitions(REFERENCE_SECTION_LABELS);

function getSectionDocumentPath(sectionName, projectName = DEFAULT_PROJECT_NAME) {
  const root = fileManager.getDocumentsPath();
  const projectFolder = sanitizeFilename(projectName);
  const fileName = `${sanitizeFilename(sectionName)}.txt`;
  return joinPathSegmentsWithinRoot(root, [projectFolder, fileName], { resolveSymlinks: false });
}

function createStableProjectId() {
  const randomPart = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  return `project-${randomPart}`;
}

function isPlainObjectValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeStableProjectId(projectId) {
  if (typeof projectId !== 'string') {
    return '';
  }

  const normalized = projectId.trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length > 128) {
    return '';
  }

  if (/[\\/\u0000-\u001F]/.test(normalized)) {
    return '';
  }

  return normalized;
}

function canonicalizeComparableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeComparableValue(item));
  }
  if (isPlainObjectValue(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalizeComparableValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function getProjectManifestComparable(manifest) {
  if (!isPlainObjectValue(manifest)) {
    return null;
  }

  return {
    schemaVersion: manifest.schemaVersion,
    projectId: typeof manifest.projectId === 'string' ? manifest.projectId.trim() : manifest.projectId,
    projectName: typeof manifest.projectName === 'string' ? manifest.projectName.trim() : manifest.projectName,
    createdAtUtc: typeof manifest.createdAtUtc === 'string' ? manifest.createdAtUtc.trim() : manifest.createdAtUtc,
    bookProfile: Object.prototype.hasOwnProperty.call(manifest, 'bookProfile')
      ? canonicalizeComparableValue(manifest.bookProfile)
      : undefined,
  };
}

let bookProfileModulePromise = null;
function loadBookProfileModule() {
  if (!bookProfileModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'core', 'bookProfile.mjs')).href;
    bookProfileModulePromise = import(modulePath).catch((error) => {
      bookProfileModulePromise = null;
      throw error;
    });
  }
  return bookProfileModulePromise;
}

async function normalizeProjectManifest(manifest, projectName = DEFAULT_PROJECT_NAME) {
  const source = isPlainObjectValue(manifest) ? manifest : {};
  const stableProjectId = normalizeStableProjectId(source.projectId);
  const projectId = stableProjectId || createStableProjectId();
  const normalizedProjectName = typeof source.projectName === 'string' && source.projectName.trim().length > 0
    ? source.projectName.trim()
    : sanitizeFilename(projectName);
  const createdAtUtc = typeof source.createdAtUtc === 'string' && source.createdAtUtc.trim().length > 0
    ? source.createdAtUtc.trim()
    : new Date().toISOString();
  let bookProfile;

  if (Object.prototype.hasOwnProperty.call(source, 'bookProfile') && isPlainObjectValue(source.bookProfile)) {
    try {
      const { normalizeBookProfile } = await loadBookProfileModule();
      const normalizedBookProfileResult = normalizeBookProfile(source.bookProfile);
      if (normalizedBookProfileResult.ok) {
        bookProfile = normalizedBookProfileResult.value;
      }
    } catch (error) {
      logDevError('normalizeProjectManifest:bookProfile', error);
    }
  }

  const normalizedManifest = {
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    projectId,
    projectName: normalizedProjectName,
    createdAtUtc,
  };

  if (bookProfile) {
    normalizedManifest.bookProfile = bookProfile;
  }

  return normalizedManifest;
}

async function readProjectManifest(projectName = DEFAULT_PROJECT_NAME) {
  const manifestPath = getProjectManifestPath(projectName);
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    const sourceManifest = isPlainObjectValue(parsed) ? parsed : null;
    return {
      manifest: await normalizeProjectManifest(sourceManifest || {}, projectName),
      sourceManifestComparable: getProjectManifestComparable(sourceManifest)
    };
  } catch {
    return null;
  }
}

async function ensureProjectManifest(projectName = DEFAULT_PROJECT_NAME) {
  const manifestPath = getProjectManifestPath(projectName);
  const existingManifestRecord = await readProjectManifest(projectName);
  const existingManifest = existingManifestRecord ? existingManifestRecord.manifest : null;
  const sourceManifestComparable = existingManifestRecord ? existingManifestRecord.sourceManifestComparable : null;
  const nextManifest = await normalizeProjectManifest(existingManifest || {}, projectName);
  const shouldWrite = !sourceManifestComparable
    || JSON.stringify(sourceManifestComparable) !== JSON.stringify(nextManifest);

  if (shouldWrite) {
    const writeResult = await queueDiskOperation(
      () => fileManager.writeFileAtomic(manifestPath, JSON.stringify(nextManifest, null, 2)),
      'save project manifest'
    );
    if (!writeResult.success) {
      throw new Error(writeResult.error || 'Failed to save project manifest');
    }
  }

  return {
    manifestPath,
    manifest: nextManifest
  };
}

async function resolveProjectBindingForFile(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return null;
  }

  const projectRoot = getProjectRootPath();
  if (!isPathInside(projectRoot, filePath)) {
    return null;
  }

  const { manifestPath, manifest } = await ensureProjectManifest(DEFAULT_PROJECT_NAME);
  return {
    manifestPath,
    projectRoot,
    projectId: manifest.projectId,
    manifest,
  };
}

function getProjectRelativeFilePath(filePath, manifestPath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return '';
  }
  if (typeof manifestPath !== 'string' || !manifestPath.trim()) {
    return '';
  }

  const projectRoot = path.dirname(manifestPath);
  if (!(filePath === projectRoot || isPathInside(projectRoot, filePath))) {
    return '';
  }

  const relativePath = path.relative(projectRoot, filePath);
  return typeof relativePath === 'string' ? relativePath : '';
}

async function findProjectBindingByProjectId(projectId) {
  const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
  if (!normalizedProjectId) {
    return null;
  }

  const documentsRoot = fileManager.getDocumentsPath();
  try {
    const entries = await fs.readdir(documentsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(documentsRoot, entry.name, PROJECT_MANIFEST_FILENAME);
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const manifest = await normalizeProjectManifest(JSON.parse(raw), entry.name);
        if (manifest.projectId === normalizedProjectId) {
          return {
            manifestPath,
            projectRoot: path.dirname(manifestPath),
            manifest
          };
        }
      } catch {
        // ignore malformed or absent manifest candidates
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function resolveLastOpenedFilePath(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const lastProjectId = typeof source.lastProjectId === 'string' ? source.lastProjectId.trim() : '';
  const lastProjectRelativePath = typeof source.lastProjectRelativePath === 'string' ? source.lastProjectRelativePath.trim() : '';

  if (lastProjectId && lastProjectRelativePath) {
    const projectBinding = await findProjectBindingByProjectId(lastProjectId);
    if (projectBinding && projectBinding.projectRoot) {
      try {
        const candidatePath = joinPathSegmentsWithinRoot(projectBinding.projectRoot, [lastProjectRelativePath], {
          resolveSymlinks: false,
        });
        if ((candidatePath === projectBinding.projectRoot || isPathInside(projectBinding.projectRoot, candidatePath))
          && await fileExists(candidatePath)) {
          return candidatePath;
        }
      } catch {}
    }
  }

  const externalPath = typeof source.lastExternalFilePath === 'string' ? source.lastExternalFilePath.trim() : '';
  if (externalPath) {
    return externalPath;
  }

  const legacyPath = typeof source.lastFilePath === 'string' ? source.lastFilePath.trim() : '';
  return legacyPath || null;
}

// Путь к файлу настроек
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function logDevError(context, error) {
  if (isDevMode && error) {
    console.error(`[craftsman][${context}]`, error);
  }
}

function logMigration(message) {
  if (isDevMode) {
    console.debug(`[craftsman:migration] ${message}`);
  }
}

async function migrateUserData() {
  const appDataPath = app.getPath('appData');
  const targetPath = path.join(appDataPath, USER_DATA_FOLDER_NAME);
  const legacyPath = path.join(appDataPath, LEGACY_USER_DATA_FOLDER_NAME);
  const markerPath = path.join(targetPath, MIGRATION_MARKER);

  if (fsSync.existsSync(markerPath)) {
    logMigration('userData migration marker detected, using craftsman folder');
    await fs.mkdir(targetPath, { recursive: true }).catch(() => {});
    app.setPath('userData', targetPath);
    return targetPath;
  }

  if (hasDirectoryContent(targetPath)) {
    logMigration('craftsman userData already contains files');
    app.setPath('userData', targetPath);
    return targetPath;
  }

  if (!hasDirectoryContent(legacyPath)) {
    logMigration('no legacy userData found, creating craftsman folder');
    await fs.mkdir(targetPath, { recursive: true }).catch((error) => {
      logDevError('migrateUserData', error);
    });
    app.setPath('userData', targetPath);
    return targetPath;
  }

  try {
    logMigration(`copying userData from ${legacyPath} → ${targetPath}`);
    await copyDirectoryContents(legacyPath, targetPath);
    await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');
    logMigration('userData migration complete');
  } catch (error) {
    logDevError('migrateUserData', error);
  }

  app.setPath('userData', targetPath);
  return targetPath;
}

async function ensureUserDataFolder() {
  try {
    return await migrateUserData();
  } catch (error) {
    logDevError('ensureUserDataFolder', error);
    const fallbackPath = path.join(app.getPath('appData'), USER_DATA_FOLDER_NAME);
    await fs.mkdir(fallbackPath, { recursive: true }).catch(() => {});
    app.setPath('userData', fallbackPath);
    return fallbackPath;
  }
}

function queueDiskOperation(operation, context = 'disk') {
  const run = () =>
    operation().catch((error) => {
      logDevError(context, error);
      throw error;
    });

  const queued = diskQueue.then(run, run);
  diskQueue = queued.catch(() => {});
  return queued;
}

function clampFontSize(size) {
  return Math.max(12, Math.min(28, size));
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sendEditorText(payload) {
  if (!mainWindow) return;
  if (typeof payload === 'string') {
    currentReviewSurfacePayload = {};
    currentReviewSurfacePayloadSource = 'none';
    currentReviewSurfacePayloadContentHash = '';
    mainWindow.webContents.send('editor:set-text', { content: payload });
    return;
  }
  if (payload && typeof payload === 'object') {
    const safePayload = {
      content: typeof payload.content === 'string' ? payload.content : '',
      title: typeof payload.title === 'string' ? payload.title : '',
      path: typeof payload.path === 'string' ? payload.path : '',
      kind: typeof payload.kind === 'string' ? payload.kind : '',
      metaEnabled: Boolean(payload.metaEnabled),
      projectId: typeof payload.projectId === 'string' ? payload.projectId : '',
      bookProfile: isPlainObjectValue(payload.bookProfile) ? payload.bookProfile : null,
    };
    if (isPlainObjectValue(payload.reviewSurface)) {
      safePayload.reviewSurface = cloneJsonSafe(payload.reviewSurface);
      currentReviewSurfacePayload = cloneJsonSafe(payload.reviewSurface) || {};
      currentReviewSurfacePayloadSource = 'direct';
      currentReviewSurfacePayloadContentHash = computeHash(safePayload.content);
    } else {
      currentReviewSurfacePayload = {};
      currentReviewSurfacePayloadSource = 'none';
      currentReviewSurfacePayloadContentHash = '';
    }
    mainWindow.webContents.send('editor:set-text', safePayload);
    return;
  }
  currentReviewSurfacePayload = {};
  currentReviewSurfacePayloadSource = 'none';
  currentReviewSurfacePayloadContentHash = '';
  mainWindow.webContents.send('editor:set-text', { content: '' });
}

async function attachProjectIdToEditorPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const nextPayload = {
    content: typeof source.content === 'string' ? source.content : '',
    title: typeof source.title === 'string' ? source.title : '',
    path: typeof source.path === 'string' ? source.path : '',
    kind: typeof source.kind === 'string' ? source.kind : '',
    metaEnabled: Boolean(source.metaEnabled),
    projectId: '',
    bookProfile: null,
    reviewSurface: isPlainObjectValue(source.reviewSurface) ? cloneJsonSafe(source.reviewSurface) : undefined,
  };

  if (!nextPayload.path) {
    return nextPayload;
  }

  const projectBinding = await resolveProjectBindingForFile(nextPayload.path);
  if (projectBinding && typeof projectBinding.projectId === 'string' && projectBinding.projectId.trim()) {
    nextPayload.projectId = projectBinding.projectId.trim();
  }
  if (projectBinding && isPlainObjectValue(projectBinding.manifest) && isPlainObjectValue(projectBinding.manifest.bookProfile)) {
    nextPayload.bookProfile = projectBinding.manifest.bookProfile;
  }

  return nextPayload;
}

function sendEditorFontSize(px) {
  if (mainWindow) {
    mainWindow.webContents.send('editor:set-font-size', { px });
  }
}

function normalizeEditorSnapshotPayload(payload) {
  if (typeof payload === 'string') {
    return {
      content: payload,
      plainText: payload,
      bookProfile: null,
    };
  }

  const source = isPlainObjectValue(payload) ? payload : {};
  const content = typeof source.content === 'string'
    ? source.content
    : typeof source.text === 'string'
      ? source.text
      : '';
  return {
    content,
    plainText: typeof source.plainText === 'string' ? source.plainText : content,
    bookProfile: isPlainObjectValue(source.bookProfile) ? source.bookProfile : null,
  };
}

function requestEditorSnapshot(timeoutMs = 2500) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return Promise.reject(new Error('No active window'));
  }

  return new Promise((resolve, reject) => {
    const requestId = crypto.randomBytes(8).toString('hex');
    const timeoutId = setTimeout(() => {
      pendingSnapshotRequests.delete(requestId);
      reject(new Error('Timed out waiting for editor snapshot'));
    }, timeoutMs);

    pendingSnapshotRequests.set(requestId, { resolve, reject, timeoutId });
    mainWindow.webContents.send('editor:snapshot-request', { requestId });
  });
}

async function requestEditorText(timeoutMs = 2500) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return Promise.reject(new Error('No active window'));
  }

  return new Promise((resolve, reject) => {
    const requestId = crypto.randomBytes(8).toString('hex');
    const timeoutId = setTimeout(() => {
      pendingTextRequests.delete(requestId);
      reject(new Error('Timed out waiting for editor text'));
    }, timeoutMs);

    pendingTextRequests.set(requestId, { resolve, reject, timeoutId });
    mainWindow.webContents.send('editor:text-request', { requestId });
  });
}

function clearPendingTextRequests(reason) {
  for (const [requestId, pending] of pendingTextRequests.entries()) {
    clearTimeout(pending.timeoutId);
    pending.reject(new Error(reason));
  }
  pendingTextRequests.clear();

  for (const [requestId, pending] of pendingSnapshotRequests.entries()) {
    clearTimeout(pending.timeoutId);
    pending.reject(new Error(reason));
  }
  pendingSnapshotRequests.clear();
}

async function readCanonicalExportSnapshot(payload = {}) {
  if (typeof currentFilePath !== 'string' || !currentFilePath.trim()) {
    throw new Error('No saved canonical document is open');
  }
  if (!isAllowedFilePath(currentFilePath)) {
    throw new Error('Current canonical document path is not allowed');
  }
  if (isDirty) {
    throw new Error('Unsaved editor state cannot be used as canonical export source');
  }

  const content = await fs.readFile(currentFilePath, 'utf8');
  let bookProfile = (
    payload.options
    && isPlainObjectValue(payload.options)
    && isPlainObjectValue(payload.options.bookProfile)
  )
    ? payload.options.bookProfile
    : null;

  if (!bookProfile) {
    const projectBinding = await resolveProjectBindingForFile(currentFilePath);
    if (
      projectBinding
      && isPlainObjectValue(projectBinding.manifest)
      && isPlainObjectValue(projectBinding.manifest.bookProfile)
    ) {
      bookProfile = projectBinding.manifest.bookProfile;
    }
  }

  return normalizeEditorSnapshotPayload({
    content,
    plainText: content,
    bookProfile,
  });
}

async function persistProjectManifestAtPath(manifestPath, manifest, operationLabel = 'save project manifest') {
  const writeResult = await queueDiskOperation(
    () => fileManager.writeFileAtomic(manifestPath, JSON.stringify(manifest, null, 2)),
    operationLabel,
  );
  if (!writeResult.success) {
    throw new Error(writeResult.error || 'Failed to save project manifest');
  }
}

async function persistBookProfileForFile(filePath, bookProfile, operationLabel = 'save project manifest') {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return { persisted: false, manifest: null };
  }

  const projectBinding = await resolveProjectBindingForFile(filePath);
  if (!projectBinding || !projectBinding.manifestPath) {
    return { persisted: false, manifest: null };
  }

  const sourceManifest = isPlainObjectValue(projectBinding.manifest) ? projectBinding.manifest : {};
  const projectNameHint = typeof sourceManifest.projectName === 'string' && sourceManifest.projectName.trim()
    ? sourceManifest.projectName.trim()
    : path.basename(projectBinding.projectRoot || getProjectRootPath());
  const nextManifest = await normalizeProjectManifest(
    {
      ...sourceManifest,
      bookProfile,
    },
    projectNameHint,
  );
  const sourceComparable = JSON.stringify(getProjectManifestComparable(sourceManifest));
  const nextComparable = JSON.stringify(getProjectManifestComparable(nextManifest));

  if (sourceComparable === nextComparable) {
    return {
      persisted: false,
      manifest: nextManifest,
    };
  }

  await persistProjectManifestAtPath(projectBinding.manifestPath, nextManifest, operationLabel);
  return {
    persisted: true,
    manifest: nextManifest,
  };
}

function isFileUrl(url) {
  return typeof url === 'string' && url.startsWith('file://');
}

function resolveExistingPath(candidate) {
  const normalized = typeof candidate === 'string' ? candidate.trim() : '';
  if (!normalized) return '';
  try {
    return resolveValidatedPath(normalized, { mode: 'any' });
  } catch {
    return '';
  }
}

function getFilePathAllowlistRoots() {
  const roots = new Set();
  const candidates = [
    getProjectRootPath(),
    fileManager.getDocumentsPath(),
    app ? app.getPath('userData') : '',
  ];
  for (const candidate of candidates) {
    const resolved = resolveExistingPath(candidate);
    if (resolved) {
      roots.add(resolved);
    }
  }
  return [...roots];
}

function isAllowedFilePath(candidatePath) {
  const resolvedPath = resolveExistingPath(candidatePath);
  if (!resolvedPath) return false;
  const allowlistRoots = getFilePathAllowlistRoots();
  if (!allowlistRoots.length) return false;
  return allowlistRoots.some((rootPath) => (
    resolvedPath === rootPath || isPathInside(rootPath, resolvedPath)
  ));
}

function isAllowedFileNavigationUrl(url) {
  if (!isFileUrl(url)) return false;
  try {
    const filePath = fileURLToPath(url);
    return isAllowedFilePath(filePath);
  } catch {
    return false;
  }
}

function blockExternalNavigation(event, url) {
  if (!isAllowedFileNavigationUrl(url)) {
    event.preventDefault();
  }
}

function makeAllowlistReject(reason, filePath = '') {
  return {
    ok: false,
    error: 'Path boundary violation',
    code: FILE_NAVIGATION_FAIL_CODE,
    failSignal: FILE_NAVIGATION_FAIL_SIGNAL,
    failReason: reason,
    path: typeof filePath === 'string' ? filePath : '',
  };
}

function installContentSecurityPolicy() {
  const defaultSession = session.defaultSession;
  if (!defaultSession) {
    return;
  }

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ? { ...details.responseHeaders } : {};
    if (details.resourceType === 'mainFrame' && isFileUrl(details.url)) {
      responseHeaders['Content-Security-Policy'] = [CSP_POLICY];
    }
    callback({ responseHeaders });
  });
}

// Загрузка настроек
async function loadSettings() {
  try {
    const data = await fs.readFile(getSettingsPath(), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function normalizeMenuPresentationMode(value) {
  if (typeof value !== 'string') {
    return MENU_PRESENTATION_MODE_CLASSIC;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === MENU_PRESENTATION_MODE_COMPACT) {
    return MENU_PRESENTATION_MODE_COMPACT;
  }
  return MENU_PRESENTATION_MODE_CLASSIC;
}

function normalizeMenuLocale(value) {
  if (typeof value !== 'string') {
    return MENU_LOCALE_MODE_BASE;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === MENU_LOCALE_MODE_RU) return MENU_LOCALE_MODE_RU;
  if (normalized === MENU_LOCALE_MODE_EN) return MENU_LOCALE_MODE_EN;
  return MENU_LOCALE_MODE_BASE;
}

function createDefaultMenuCustomization() {
  return {
    schemaVersion: MENU_CUSTOMIZATION_SCHEMA_VERSION,
    hiddenMenuIds: [],
    menuOrder: [],
  };
}

function isMenuLocalCustomizationCommandId(commandId) {
  return typeof commandId === 'string' && MENU_LOCAL_CUSTOMIZATION_COMMAND_IDS.has(commandId);
}

function normalizeMenuCustomizationIdList(value, canonicalIds, includeMissing = false) {
  const canonicalList = Array.isArray(canonicalIds)
    ? canonicalIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];
  const useCanonicalFilter = canonicalList.length > 0;
  const canonicalSet = new Set(canonicalList);
  const sourceList = Array.isArray(value) ? value : [];
  const normalized = [];
  const seen = new Set();

  sourceList.forEach((entry) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      return;
    }
    if ((useCanonicalFilter && !canonicalSet.has(entry)) || seen.has(entry)) {
      return;
    }
    seen.add(entry);
    normalized.push(entry);
  });

  if (includeMissing && useCanonicalFilter) {
    canonicalList.forEach((id) => {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      normalized.push(id);
    });
  }

  return normalized;
}

function normalizeMenuCustomizationState(value, canonicalIds = []) {
  const canonicalList = Array.isArray(canonicalIds)
    ? canonicalIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  if (!isRuntimeRecord(value) || Number(value.schemaVersion) !== MENU_CUSTOMIZATION_SCHEMA_VERSION) {
    return {
      schemaVersion: MENU_CUSTOMIZATION_SCHEMA_VERSION,
      hiddenMenuIds: [],
      menuOrder: canonicalList.slice(),
    };
  }

  return {
    schemaVersion: MENU_CUSTOMIZATION_SCHEMA_VERSION,
    hiddenMenuIds: normalizeMenuCustomizationIdList(value.hiddenMenuIds, canonicalList, false),
    menuOrder: normalizeMenuCustomizationIdList(value.menuOrder, canonicalList, true),
  };
}

function cloneMenuConfigItem(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const cloned = { ...item };
  if (Array.isArray(item.items)) {
    cloned.items = item.items.map((child) => cloneMenuConfigItem(child));
  }
  if (Array.isArray(item.submenu)) {
    cloned.submenu = item.submenu.map((child) => cloneMenuConfigItem(child));
  }
  return cloned;
}

function resolveCustomizableMenuSections(config) {
  if (!isRuntimeRecord(config) || !Array.isArray(config.menus)) {
    return [];
  }

  return config.menus
    .filter((menuItem) => menuItem && typeof menuItem.id === 'string' && menuItem.id.length > 0)
    .filter((menuItem) => !MENU_CUSTOMIZATION_FIXED_PREFIX_ID_SET.has(menuItem.id)
      && menuItem.id !== MENU_CUSTOMIZATION_FIXED_TAIL_ID)
    .map((menuItem) => ({
      id: menuItem.id,
      label: typeof menuItem.label === 'string' && menuItem.label.length > 0
        ? menuItem.label
        : menuItem.id,
    }));
}

function resolveOrderedCustomizableMenuSections(config) {
  const sections = resolveCustomizableMenuSections(config);
  if (sections.length === 0) {
    return [];
  }

  const normalizedState = normalizeMenuCustomizationState(
    currentMenuCustomization,
    sections.map((section) => section.id),
  );
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  return normalizedState.menuOrder
    .map((sectionId) => sectionById.get(sectionId))
    .filter(Boolean);
}

function syncCurrentMenuCustomization(config) {
  const sectionIds = resolveCustomizableMenuSections(config).map((section) => section.id);
  currentMenuCustomizationSectionIds = sectionIds;
  currentMenuCustomization = normalizeMenuCustomizationState(currentMenuCustomization, sectionIds);
  return currentMenuCustomization;
}

function isMenuCustomizationSectionHidden(sectionId) {
  return Array.isArray(currentMenuCustomization.hiddenMenuIds)
    && currentMenuCustomization.hiddenMenuIds.includes(sectionId);
}

function isMenuCustomizationSectionVisible(sectionId) {
  return !isMenuCustomizationSectionHidden(sectionId);
}

function getCurrentCustomizationSectionIds() {
  return Array.isArray(currentMenuCustomizationSectionIds)
    ? currentMenuCustomizationSectionIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];
}

function normalizeCustomizationStateForCurrentSections(state) {
  return normalizeMenuCustomizationState(state, getCurrentCustomizationSectionIds());
}

function cloneMenuCustomizationState(state) {
  return {
    schemaVersion: MENU_CUSTOMIZATION_SCHEMA_VERSION,
    hiddenMenuIds: Array.isArray(state?.hiddenMenuIds) ? [...state.hiddenMenuIds] : [],
    menuOrder: Array.isArray(state?.menuOrder) ? [...state.menuOrder] : [],
  };
}

function setCurrentMenuCustomization(nextCustomization) {
  currentMenuCustomization = normalizeCustomizationStateForCurrentSections(nextCustomization);
  return currentMenuCustomization;
}

function moveMenuCustomizationSection(sectionId, direction) {
  const normalized = normalizeCustomizationStateForCurrentSections(currentMenuCustomization);
  const sectionIds = getCurrentCustomizationSectionIds();
  if (!sectionIds.includes(sectionId)) {
    return normalized;
  }

  const nextOrder = normalized.menuOrder.slice();
  const currentIndex = nextOrder.indexOf(sectionId);
  if (currentIndex < 0) {
    return normalized;
  }

  const nextIndex = direction === 'earlier' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= nextOrder.length) {
    return normalized;
  }

  const [movedItem] = nextOrder.splice(currentIndex, 1);
  nextOrder.splice(nextIndex, 0, movedItem);
  return {
    schemaVersion: MENU_CUSTOMIZATION_SCHEMA_VERSION,
    hiddenMenuIds: normalized.hiddenMenuIds.slice(),
    menuOrder: nextOrder,
  };
}

async function persistMenuCustomization(nextCustomization, logLabel) {
  const normalized = setCurrentMenuCustomization(nextCustomization);
  let persisted = false;

  try {
    const settings = await loadSettings();
    settings[MENU_CUSTOMIZATION_SETTING_KEY] = normalized;
    await saveSettings(settings);
    persisted = true;
  } catch (error) {
    logDevError(`${logLabel}:saveSettings`, error);
  }

  try {
    createMenu();
    return { ok: true, persisted, menuCustomization: normalized };
  } catch (error) {
    logDevError(`${logLabel}:createMenu`, error);
    return {
      ok: false,
      persisted,
      menuCustomization: normalized,
      reason: 'MENU_REBUILD_FAILED',
    };
  }
}

async function loadMenuPresentationModeFromSettings() {
  try {
    const settings = await loadSettings();
    currentMenuPresentationMode = normalizeMenuPresentationMode(
      settings[MENU_PRESENTATION_MODE_SETTING_KEY]
    );
  } catch {
    currentMenuPresentationMode = MENU_PRESENTATION_MODE_CLASSIC;
  }
}

async function loadMenuLocaleFromSettings() {
  try {
    const settings = await loadSettings();
    currentMenuLocale = normalizeMenuLocale(settings[MENU_LOCALE_SETTING_KEY]);
  } catch {
    currentMenuLocale = MENU_LOCALE_MODE_BASE;
  }
}

async function loadMenuCustomizationFromSettings() {
  try {
    const settings = await loadSettings();
    currentMenuCustomization = normalizeMenuCustomizationState(
      settings[MENU_CUSTOMIZATION_SETTING_KEY],
      [],
    );
  } catch {
    currentMenuCustomization = createDefaultMenuCustomization();
  }
}

async function setMenuPresentationMode(mode) {
  const nextMode = normalizeMenuPresentationMode(mode);
  let persisted = false;

  currentMenuPresentationMode = nextMode;
  try {
    const settings = await loadSettings();
    settings[MENU_PRESENTATION_MODE_SETTING_KEY] = nextMode;
    await saveSettings(settings);
    persisted = true;
  } catch (error) {
    logDevError('setMenuPresentationMode:saveSettings', error);
  }

  try {
    createMenu();
    return { ok: true, persisted, menuPresentationMode: nextMode };
  } catch (error) {
    logDevError('setMenuPresentationMode:createMenu', error);
    return {
      ok: false,
      persisted,
      menuPresentationMode: nextMode,
      reason: 'MENU_REBUILD_FAILED',
    };
  }
}

async function setMenuLocale(locale) {
  const nextLocale = normalizeMenuLocale(locale);
  let persisted = false;

  currentMenuLocale = nextLocale;
  try {
    const settings = await loadSettings();
    settings[MENU_LOCALE_SETTING_KEY] = nextLocale;
    await saveSettings(settings);
    persisted = true;
  } catch (error) {
    logDevError('setMenuLocale:saveSettings', error);
  }

  try {
    createMenu();
    return { ok: true, persisted, menuLocale: nextLocale };
  } catch (error) {
    logDevError('setMenuLocale:createMenu', error);
    return {
      ok: false,
      persisted,
      menuLocale: nextLocale,
      reason: 'MENU_REBUILD_FAILED',
    };
  }
}

async function resetMenuCustomization() {
  return persistMenuCustomization(createDefaultMenuCustomization(), 'resetMenuCustomization');
}

async function toggleMenuSectionVisibility(sectionId) {
  const normalized = normalizeCustomizationStateForCurrentSections(currentMenuCustomization);
  if (typeof sectionId !== 'string' || sectionId.length === 0) {
    return {
      ok: false,
      persisted: false,
      menuCustomization: normalized,
      reason: 'INVALID_MENU_CUSTOMIZATION_SECTION_ID',
    };
  }

  if (!getCurrentCustomizationSectionIds().includes(sectionId)) {
    return {
      ok: true,
      persisted: false,
      menuCustomization: normalized,
    };
  }

  const hiddenSet = new Set(normalized.hiddenMenuIds);
  if (hiddenSet.has(sectionId)) {
    hiddenSet.delete(sectionId);
  } else {
    hiddenSet.add(sectionId);
  }

  return persistMenuCustomization({
    schemaVersion: MENU_CUSTOMIZATION_SCHEMA_VERSION,
    hiddenMenuIds: Array.from(hiddenSet),
    menuOrder: normalized.menuOrder.slice(),
  }, 'toggleMenuSectionVisibility');
}

async function moveMenuSectionEarlier(sectionId) {
  if (typeof sectionId !== 'string' || sectionId.length === 0) {
    return {
      ok: false,
      persisted: false,
      menuCustomization: normalizeCustomizationStateForCurrentSections(currentMenuCustomization),
      reason: 'INVALID_MENU_CUSTOMIZATION_SECTION_ID',
    };
  }

  if (!getCurrentCustomizationSectionIds().includes(sectionId)) {
    return {
      ok: true,
      persisted: false,
      menuCustomization: normalizeCustomizationStateForCurrentSections(currentMenuCustomization),
    };
  }

  return persistMenuCustomization(
    moveMenuCustomizationSection(sectionId, 'earlier'),
    'moveMenuSectionEarlier',
  );
}

async function moveMenuSectionLater(sectionId) {
  if (typeof sectionId !== 'string' || sectionId.length === 0) {
    return {
      ok: false,
      persisted: false,
      menuCustomization: normalizeCustomizationStateForCurrentSections(currentMenuCustomization),
      reason: 'INVALID_MENU_CUSTOMIZATION_SECTION_ID',
    };
  }

  if (!getCurrentCustomizationSectionIds().includes(sectionId)) {
    return {
      ok: true,
      persisted: false,
      menuCustomization: normalizeCustomizationStateForCurrentSections(currentMenuCustomization),
    };
  }

  return persistMenuCustomization(
    moveMenuCustomizationSection(sectionId, 'later'),
    'moveMenuSectionLater',
  );
}

// Сохранение настроек
async function saveSettings(settings) {
  try {
    await queueDiskOperation(
      () => fileManager.writeFileAtomic(getSettingsPath(), JSON.stringify(settings)),
      'save settings'
    );
  } catch {
    // Тихая обработка ошибок
  }
}

// Сохранение последнего открытого файла
async function saveLastFile() {
  try {
    const settings = await loadSettings();
    const projectBinding = await resolveProjectBindingForFile(currentFilePath);
    if (projectBinding && projectBinding.projectId) {
      const projectId = projectBinding.projectId;
      const relativePath = getProjectRelativeFilePath(currentFilePath, projectBinding.manifestPath);
      settings.projectId = projectId;
      settings.projectManifestPath = projectBinding.manifestPath;
      settings.lastProjectId = projectId;
      if (relativePath) {
        settings.lastProjectRelativePath = relativePath;
      } else {
        delete settings.lastProjectRelativePath;
      }
      delete settings.lastExternalFilePath;
    } else {
      delete settings.projectId;
      delete settings.projectManifestPath;
      delete settings.lastProjectId;
      delete settings.lastProjectRelativePath;
      if (typeof currentFilePath === 'string' && currentFilePath.trim()) {
        settings.lastExternalFilePath = currentFilePath;
      } else {
        delete settings.lastExternalFilePath;
      }
    }
    delete settings.lastFilePath;
    await saveSettings(settings);
  } catch (error) {
    // Тихая обработка ошибок
  }
}

// Загрузка последнего открытого файла
async function loadLastFile() {
  try {
    const settings = await loadSettings();
    return await resolveLastOpenedFilePath(settings);
  } catch (error) {
    return null;
  }
}

function computeHash(text) {
  return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex');
}

function makeTypedExportError(code, reason, details) {
  const error = {
    code: typeof code === 'string' && code.length > 0 ? code : 'E_EXPORT_DOCXMIN_FAILED',
    op: EXPORT_DOCX_MIN_CHANNEL,
    reason: typeof reason === 'string' && reason.length > 0 ? reason : 'EXPORT_DOCXMIN_FAILED',
  };
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = details;
  }
  return { ok: 0, error };
}

function buildPathBoundaryDetails(pathBoundaryError) {
  const source = pathBoundaryError && typeof pathBoundaryError === 'object' ? pathBoundaryError : {};
  return {
    failSignal: 'E_PATH_BOUNDARY_VIOLATION',
    failReason: typeof source.failReason === 'string' ? source.failReason : 'PATH_BOUNDARY_VIOLATION',
    field: typeof source.field === 'string' ? source.field : '',
    normalizedPath: typeof source.normalizedPath === 'string' ? source.normalizedPath : '',
  };
}

let markdownTransformModulePromise = null;
function loadMarkdownTransformModule() {
  if (!markdownTransformModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'export', 'markdown', 'v1', 'index.mjs')).href;
    markdownTransformModulePromise = import(modulePath).catch((error) => {
      markdownTransformModulePromise = null;
      throw error;
    });
  }
  return markdownTransformModulePromise;
}

let markdownIoModulePromise = null;
function loadMarkdownIoModule() {
  if (!markdownIoModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'io', 'markdown', 'index.mjs')).href;
    markdownIoModulePromise = import(modulePath).catch((error) => {
      markdownIoModulePromise = null;
      throw error;
    });
  }
  return markdownIoModulePromise;
}

let docxPageSetupBindModulePromise = null;
function loadDocxPageSetupBindModule() {
  if (!docxPageSetupBindModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'docxPageSetupBind.mjs')).href;
    docxPageSetupBindModulePromise = import(modulePath).catch((error) => {
      docxPageSetupBindModulePromise = null;
      throw error;
    });
  }
  return docxPageSetupBindModulePromise;
}

let semanticMappingModulePromise = null;
function loadSemanticMappingModule() {
  if (!semanticMappingModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'derived', 'semanticMapping.mjs')).href;
    semanticMappingModulePromise = import(modulePath).catch((error) => {
      semanticMappingModulePromise = null;
      throw error;
    });
  }
  return semanticMappingModulePromise;
}

let styleMapModulePromise = null;
function loadStyleMapModule() {
  if (!styleMapModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'derived', 'styleMap.mjs')).href;
    styleMapModulePromise = import(modulePath).catch((error) => {
      styleMapModulePromise = null;
      throw error;
    });
  }
  return styleMapModulePromise;
}

let revisionBridgeModulePromise = null;
function loadRevisionBridgeModule() {
  if (!revisionBridgeModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'io', 'revisionBridge', 'index.mjs')).href;
    revisionBridgeModulePromise = import(modulePath).catch((error) => {
      revisionBridgeModulePromise = null;
      throw error;
    });
  }
  return revisionBridgeModulePromise;
}

let exactTextMinSafeWriteModulePromise = null;
function loadExactTextMinSafeWriteModule() {
  if (!exactTextMinSafeWriteModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'io', 'revisionBridge', 'exactTextMinSafeWrite.mjs')).href;
    exactTextMinSafeWriteModulePromise = import(modulePath).catch((error) => {
      exactTextMinSafeWriteModulePromise = null;
      throw error;
    });
  }
  return exactTextMinSafeWriteModulePromise;
}

function normalizeReviewExactTextApplyString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function makeReviewExactTextApplyContextBlock(reason, details = undefined) {
  return {
    ok: false,
    code: 'E_REVIEW_EXACT_TEXT_APPLY_CONTEXT_BLOCKED',
    reason,
    ...(isPlainObjectValue(details) && Object.keys(details).length > 0 ? { details } : {}),
  };
}

function readReviewExactTextApplyBaselineHash(activeSession, revisionSession) {
  return normalizeReviewExactTextApplyString(activeSession?.baselineHash)
    || normalizeReviewExactTextApplyString(revisionSession?.baselineHash);
}

function readReviewExactTextApplyCurrentBaselineHash(activeSession) {
  return normalizeReviewExactTextApplyString(activeSession?.currentBaselineHash)
    || normalizeReviewExactTextApplyString(activeSession?.reviewSurface?.currentBaselineHash)
    || normalizeReviewExactTextApplyString(activeSession?.reviewSurface?.stage01Preview?.currentBaselineHash);
}

function reviewExactTextSceneIdMatchesCurrentPath(sceneId, filePath, projectRoot) {
  const normalizedSceneId = normalizeReviewExactTextApplyString(sceneId);
  if (!normalizedSceneId) return false;

  const resolvedFilePath = path.resolve(filePath);
  if (normalizedSceneId === filePath || normalizedSceneId === resolvedFilePath) {
    return true;
  }

  if (path.isAbsolute(normalizedSceneId)) {
    return path.resolve(normalizedSceneId) === resolvedFilePath;
  }

  const relativePath = path.relative(projectRoot, resolvedFilePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false;
  }
  const relativePosixPath = relativePath.split(path.sep).join('/');
  const normalizedRelativeSceneId = normalizedSceneId.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalizedRelativeSceneId === relativePosixPath;
}

async function readReviewExactTextApplyProjectBinding(filePath) {
  const projectRoot = getProjectRootPath();
  if (!isPathInside(projectRoot, filePath)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PATH_OUTSIDE_PROJECT');
  }

  const manifestPath = getProjectManifestPath();
  let manifest = null;
  try {
    const rawManifest = await fs.readFile(manifestPath, 'utf8');
    manifest = await normalizeProjectManifest(JSON.parse(rawManifest), DEFAULT_PROJECT_NAME);
  } catch (error) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PROJECT_BINDING_UNAVAILABLE', {
      errorCode: normalizeReviewExactTextApplyString(error?.code),
    });
  }

  return {
    ok: true,
    projectRoot,
    manifestPath,
    manifest,
    projectId: normalizeReviewExactTextApplyString(manifest.projectId),
  };
}

async function buildReviewExactTextApplyInputFromMainState(request = {}) {
  const activeSession = isPlainObjectValue(request.activeSession) ? request.activeSession : {};
  const revisionSession = isPlainObjectValue(request.revisionSession) ? request.revisionSession : {};
  const textChange = isPlainObjectValue(request.textChange) ? request.textChange : {};
  const reviewItem = isPlainObjectValue(request.reviewItem) ? request.reviewItem : {};
  const sceneId = normalizeReviewExactTextApplyString(textChange.targetScope?.id);
  const targetScopeType = normalizeReviewExactTextApplyString(textChange.targetScope?.type);

  if (targetScopeType !== 'scene' || !sceneId) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_SCENE_SCOPE_REQUIRED');
  }

  if (isDirty || autoSaveInProgress) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED', {
      isDirty: Boolean(isDirty),
      autoSaveInProgress: Boolean(autoSaveInProgress),
    });
  }

  if (typeof currentFilePath !== 'string' || !currentFilePath.trim()) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_REQUIRED');
  }
  if (!isAllowedFilePath(currentFilePath)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_NOT_ALLOWED');
  }

  const binding = await readReviewExactTextApplyProjectBinding(currentFilePath);
  if (!binding.ok) return binding;

  const expectedProjectId = normalizeReviewExactTextApplyString(activeSession.projectId)
    || normalizeReviewExactTextApplyString(revisionSession.projectId);
  if (!expectedProjectId) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PROJECT_ID_REQUIRED');
  }
  if (binding.projectId && binding.projectId !== expectedProjectId) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PROJECT_MISMATCH', {
      expectedProjectId,
      observedProjectId: binding.projectId,
    });
  }

  const documentContext = getDocumentContextFromPath(currentFilePath);
  if (!['scene', 'chapter-file'].includes(documentContext.kind)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_NOT_SCENE', {
      kind: typeof documentContext.kind === 'string' ? documentContext.kind : '',
    });
  }

  if (!reviewExactTextSceneIdMatchesCurrentPath(sceneId, currentFilePath, binding.projectRoot)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_SCENE_BINDING_MISMATCH');
  }

  const baselineHash = readReviewExactTextApplyBaselineHash(activeSession, revisionSession);
  if (!baselineHash) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_BASELINE_REQUIRED');
  }
  const currentBaselineHash = readReviewExactTextApplyCurrentBaselineHash(activeSession);
  let sceneText = '';
  try {
    sceneText = await fs.readFile(currentFilePath, 'utf8');
  } catch (error) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_READ_FAILED', {
      errorCode: normalizeReviewExactTextApplyString(error?.code),
    });
  }

  const projectSnapshot = {
    projectId: expectedProjectId,
    baselineHash: currentBaselineHash || baselineHash,
    scenes: [
      {
        sceneId,
        text: sceneText,
      },
    ],
  };

  let revisionBridge = null;
  try {
    revisionBridge = await loadRevisionBridgeModule();
  } catch (error) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PLAN_BUILDER_UNAVAILABLE', {
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    });
  }
  if (!revisionBridge || typeof revisionBridge.buildExactTextApplyPlanNoDiskPreview !== 'function') {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PLAN_BUILDER_UNAVAILABLE');
  }

  const planPreview = revisionBridge.buildExactTextApplyPlanNoDiskPreview({
    projectSnapshot,
    revisionSession,
    reviewItem,
  });
  if (!isPlainObjectValue(planPreview) || planPreview.status !== 'ready' || !isPlainObjectValue(planPreview.plan)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PLAN_BLOCKED', {
      planStatus: typeof planPreview?.status === 'string' ? planPreview.status : '',
      planCode: typeof planPreview?.code === 'string' ? planPreview.code : '',
      planReason: typeof planPreview?.reason === 'string' ? planPreview.reason : '',
      planReasons: Array.isArray(planPreview?.reasons)
        ? cloneJsonSafe(planPreview.reasons)
        : [],
    });
  }

  return {
    ok: true,
    input: {
      projectRoot: binding.projectRoot,
      projectSnapshot,
      revisionSession: cloneJsonSafe(revisionSession) || {},
      reviewItem: cloneJsonSafe(reviewItem) || {},
      planPreview,
      scenePath: currentFilePath,
      scenePathBySceneId: {
        [sceneId]: currentFilePath,
      },
    },
  };
}

async function buildReviewExactTextApplyBatchInputFromMainState(request = {}) {
  const activeSession = isPlainObjectValue(request.activeSession) ? request.activeSession : {};
  const revisionSession = isPlainObjectValue(request.revisionSession) ? request.revisionSession : {};
  const textChanges = Array.isArray(request.textChanges)
    ? request.textChanges.filter((change) => isPlainObjectValue(change))
    : [];
  if (textChanges.length === 0) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_BATCH_TEXT_CHANGES_REQUIRED');
  }

  const sceneIds = [...new Set(textChanges
    .map((change) => normalizeReviewExactTextApplyString(change.targetScope?.id))
    .filter(Boolean))];
  const targetScopeTypes = [...new Set(textChanges
    .map((change) => normalizeReviewExactTextApplyString(change.targetScope?.type))
    .filter(Boolean))];
  if (targetScopeTypes.length !== 1 || targetScopeTypes[0] !== 'scene' || sceneIds.length !== 1) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_BATCH_SINGLE_SCENE_REQUIRED', {
      sceneIds,
      targetScopeTypes,
    });
  }
  const sceneId = sceneIds[0];

  if (isDirty || autoSaveInProgress) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED', {
      isDirty: Boolean(isDirty),
      autoSaveInProgress: Boolean(autoSaveInProgress),
    });
  }

  if (typeof currentFilePath !== 'string' || !currentFilePath.trim()) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_REQUIRED');
  }
  if (!isAllowedFilePath(currentFilePath)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_NOT_ALLOWED');
  }

  const binding = await readReviewExactTextApplyProjectBinding(currentFilePath);
  if (!binding.ok) return binding;

  const expectedProjectId = normalizeReviewExactTextApplyString(activeSession.projectId)
    || normalizeReviewExactTextApplyString(revisionSession.projectId);
  if (!expectedProjectId) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PROJECT_ID_REQUIRED');
  }
  if (binding.projectId && binding.projectId !== expectedProjectId) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_PROJECT_MISMATCH', {
      expectedProjectId,
      observedProjectId: binding.projectId,
    });
  }

  const documentContext = getDocumentContextFromPath(currentFilePath);
  if (!['scene', 'chapter-file'].includes(documentContext.kind)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_NOT_SCENE', {
      kind: typeof documentContext.kind === 'string' ? documentContext.kind : '',
    });
  }

  if (!reviewExactTextSceneIdMatchesCurrentPath(sceneId, currentFilePath, binding.projectRoot)) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_SCENE_BINDING_MISMATCH');
  }

  const baselineHash = readReviewExactTextApplyBaselineHash(activeSession, revisionSession);
  if (!baselineHash) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_BASELINE_REQUIRED');
  }
  const currentBaselineHash = readReviewExactTextApplyCurrentBaselineHash(activeSession);
  let sceneText = '';
  try {
    sceneText = await fs.readFile(currentFilePath, 'utf8');
  } catch (error) {
    return makeReviewExactTextApplyContextBlock('REVIEW_EXACT_TEXT_APPLY_CURRENT_FILE_READ_FAILED', {
      errorCode: normalizeReviewExactTextApplyString(error?.code),
    });
  }

  const projectSnapshot = {
    projectId: expectedProjectId,
    baselineHash: currentBaselineHash || baselineHash,
    scenes: [
      {
        sceneId,
        text: sceneText,
      },
    ],
  };

  return {
    ok: true,
    input: {
      projectRoot: binding.projectRoot,
      projectSnapshot,
      revisionSession: cloneJsonSafe(revisionSession) || {},
      reviewItems: cloneJsonSafe(textChanges) || [],
      scenePath: currentFilePath,
      scenePathBySceneId: {
        [sceneId]: currentFilePath,
      },
    },
  };
}

async function runReviewExactTextSafeWriteFromMainState(applyExactTextMinSafeWrite, input, safeWriteOptions = {}) {
  if (typeof applyExactTextMinSafeWrite !== 'function') {
    throw new Error('applyExactTextMinSafeWrite is required');
  }
  return queueDiskOperation(
    () => {
      if (isDirty || autoSaveInProgress) {
        return {
          ok: false,
          status: 'blocked',
          code: 'E_REVIEW_EXACT_TEXT_APPLY_CONTEXT_BLOCKED',
          reason: 'REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED',
          applied: false,
          reasons: [
            {
              code: 'REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED',
              field: 'editorState',
              message: 'editor became dirty before queued exact text apply',
            },
          ],
        };
      }
      return applyExactTextMinSafeWrite(input, safeWriteOptions);
    },
    'review exact text safe apply',
  );
}

async function runReviewExactTextBatchSafeWriteFromMainState(applyExactTextBatchMinSafeWrite, input, safeWriteOptions = {}) {
  if (typeof applyExactTextBatchMinSafeWrite !== 'function') {
    throw new Error('applyExactTextBatchMinSafeWrite is required');
  }
  return queueDiskOperation(
    () => {
      if (isDirty || autoSaveInProgress) {
        return {
          ok: false,
          status: 'blocked',
          code: 'E_REVIEW_EXACT_TEXT_APPLY_CONTEXT_BLOCKED',
          reason: 'REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED',
          applied: false,
          reasons: [
            {
              code: 'REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED',
              field: 'editorState',
              message: 'editor became dirty before queued exact text batch apply',
            },
          ],
        };
      }
      return applyExactTextBatchMinSafeWrite(input, safeWriteOptions);
    },
    'review exact text batch safe apply',
  );
}

async function syncReviewExactTextApplyEditorFromMainState(request = {}) {
  const applyInput = isPlainObjectValue(request.applyInput) ? request.applyInput : {};
  const reviewSurface = isPlainObjectValue(request.reviewSurface) ? request.reviewSurface : {};
  const scenePath = normalizeReviewExactTextApplyString(applyInput.scenePath);
  if (!scenePath || scenePath !== currentFilePath) {
    return {
      ok: false,
      skipped: true,
      reason: 'REVIEW_EXACT_TEXT_APPLY_EDITOR_SYNC_NOT_CURRENT_FILE',
    };
  }
  if (!mainWindow || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
    return {
      ok: false,
      skipped: true,
      reason: 'REVIEW_EXACT_TEXT_APPLY_EDITOR_SYNC_WINDOW_UNAVAILABLE',
    };
  }

  const content = await fs.readFile(currentFilePath, 'utf8');
  const context = getDocumentContextFromPath(currentFilePath);
  sendEditorText(await attachProjectIdToEditorPayload({
    content,
    title: context.title,
    path: currentFilePath,
    kind: context.kind,
    metaEnabled: context.metaEnabled,
    reviewSurface,
  }));
  const contentHash = computeHash(content);
  lastAutosaveHash = contentHash;
  backupHashes.set(currentFilePath, contentHash);
  setDirtyState(false);
  updateStatus('Применено');
  return {
    ok: true,
    skipped: false,
    contentHash,
  };
}

function mapMarkdownErrorCode(inputCode, inputReason) {
  const code = typeof inputCode === 'string' ? inputCode : '';
  const reason = typeof inputReason === 'string' ? inputReason : '';
  if (code.startsWith('MDV1_')) return code;
  if (code.startsWith('E_IO_')) return code;
  if (code === 'E_MD_LIMIT_SIZE') return 'MDV1_INPUT_TOO_LARGE';
  if (code === 'E_MD_LIMIT_DEPTH' || code === 'E_MD_LIMIT_NODES' || code === 'E_MD_LIMIT_TIMEOUT') {
    return 'MDV1_LIMIT_EXCEEDED';
  }
  if (code === 'E_MD_SECURITY_URI_SCHEME_DENIED' || code === 'E_MD_SECURITY_RAW_HTML') {
    return 'MDV1_SECURITY_VIOLATION';
  }
  if (code === 'E_MD_SERIALIZE_UNKNOWN_BLOCK' || code === 'E_MD_UNSUPPORTED_FEATURE') {
    return 'MDV1_UNSUPPORTED_FEATURE';
  }
  if (reason.includes('unsupported')) {
    return 'MDV1_UNSUPPORTED_FEATURE';
  }
  return 'MDV1_INTERNAL_ERROR';
}

function normalizeMarkdownSafetyMode(input) {
  return input === 'compat' ? 'compat' : 'strict';
}

function getMarkdownRecoveryGuidance(code) {
  if (code === 'E_IO_INTEGRITY_MISMATCH') {
    return {
      userMessage: 'Нарушена целостность Markdown. Действия: Open Snapshot / Retry / Abort.',
      recoveryActions: ['OPEN_SNAPSHOT', 'RETRY', 'ABORT'],
    };
  }
  if (code === 'E_IO_ATOMIC_WRITE_FAIL') {
    return {
      userMessage: 'Не удалось безопасно записать Markdown. Действия: Retry / Save As / Open Snapshot.',
      recoveryActions: ['RETRY', 'SAVE_AS', 'OPEN_SNAPSHOT'],
    };
  }
  if (code === 'E_IO_SNAPSHOT_FAIL') {
    return {
      userMessage: 'Не удалось создать recovery snapshot. Действия: Retry / Save As.',
      recoveryActions: ['RETRY', 'SAVE_AS'],
    };
  }
  if (code === 'E_IO_CORRUPT_INPUT') {
    return {
      userMessage: 'Markdown поврежден. Действия: Open Snapshot / Retry.',
      recoveryActions: ['OPEN_SNAPSHOT', 'RETRY'],
    };
  }
  if (code === 'E_IO_INVALID_ENCODING' || code === 'E_IO_TRUNCATED_INPUT') {
    return {
      userMessage: 'Markdown поврежден кодировкой. Действия: Open Snapshot / Retry / Abort.',
      recoveryActions: ['OPEN_SNAPSHOT', 'RETRY', 'ABORT'],
    };
  }
  if (code === 'E_IO_SNAPSHOT_MISSING') {
    return {
      userMessage: 'Recovery snapshot не найден. Действия: Retry / Save As / Abort.',
      recoveryActions: ['RETRY', 'SAVE_AS', 'ABORT'],
    };
  }
  if (code === 'E_IO_SNAPSHOT_MISMATCH') {
    return {
      userMessage: 'Recovery snapshot поврежден. Действия: Retry / Save As / Abort.',
      recoveryActions: ['RETRY', 'SAVE_AS', 'ABORT'],
    };
  }
  if (code === 'E_IO_INPUT_TOO_LARGE') {
    return {
      userMessage: 'Markdown слишком большой. Действия: Save As / Retry с меньшим файлом.',
      recoveryActions: ['SAVE_AS', 'RETRY'],
    };
  }
  if (code.startsWith('E_IO_')) {
    return {
      userMessage: 'Ошибка ввода-вывода Markdown. Действия: Retry / Save As / Abort.',
      recoveryActions: ['RETRY', 'SAVE_AS', 'ABORT'],
    };
  }
  return null;
}

function makeTypedMarkdownError(op, inputCode, inputReason, details) {
  const mappedCode = mapMarkdownErrorCode(inputCode, inputReason);
  const error = {
    code: mappedCode,
    op,
    reason: typeof inputReason === 'string' && inputReason.length > 0
      ? inputReason
      : 'MARKDOWN_COMMAND_FAILED',
  };
  const recovery = getMarkdownRecoveryGuidance(mappedCode);
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = { ...details };
  }
  if (recovery) {
    error.details = {
      ...(error.details && typeof error.details === 'object' ? error.details : {}),
      userMessage: recovery.userMessage,
      recoveryActions: recovery.recoveryActions,
    };
  }
  return { ok: 0, error };
}

async function appendMarkdownReliabilityLog(markdownIo, input = {}) {
  if (!markdownIo || typeof markdownIo.buildReliabilityLogRecord !== 'function') {
    return { logRecord: null, logPath: '' };
  }
  const logRecord = markdownIo.buildReliabilityLogRecord({
    op: input.op,
    code: input.code,
    reason: input.reason,
    safetyMode: input.safetyMode,
    sourcePath: input.sourcePath,
    targetPath: input.targetPath,
    snapshotPath: input.snapshotPath,
    recoveryActions: input.recoveryActions,
  });
  if (typeof markdownIo.appendReliabilityLog !== 'function') {
    return { logRecord, logPath: '' };
  }
  try {
    const appended = await markdownIo.appendReliabilityLog(logRecord, {
      logPath: MARKDOWN_RELIABILITY_LOG_PATH,
    });
    return { logRecord, logPath: appended && typeof appended.logPath === 'string' ? appended.logPath : '' };
  } catch {
    return { logRecord, logPath: '' };
  }
}

function normalizeMarkdownImportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const normalized = {
    text: typeof payload.text === 'string'
      ? payload.text
      : (typeof payload.markdown === 'string' ? payload.markdown : ''),
    sourceName: typeof payload.sourceName === 'string' ? payload.sourceName : '',
    sourcePath: typeof payload.sourcePath === 'string' ? payload.sourcePath : '',
    preview: payload.preview === true,
    safeCreate: payload.safeCreate === true,
    previewPayload: payload.previewPayload && typeof payload.previewPayload === 'object' && !Array.isArray(payload.previewPayload)
      ? cloneJsonSafe(payload.previewPayload)
      : null,
    limits: payload.limits && typeof payload.limits === 'object' && !Array.isArray(payload.limits)
      ? payload.limits
      : {},
  };
  const pathGuard = sanitizePathFields(normalized, ['sourcePath'], { mode: 'any' });
  if (!pathGuard.ok) {
    return {
      ...normalized,
      pathBoundaryError: pathGuard,
    };
  }
  return pathGuard.payload;
}

function buildMarkdownImportSafeCreatePlan(payload, markdownText) {
  const sourceName = typeof payload?.sourceName === 'string' ? payload.sourceName : '';
  const normalizedSource = sourceName
    .replace(/\.md$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safeBaseName = sanitizeFilename(normalizedSource || 'Imported scene');
  const content = normalizeFlowTextInput(markdownText);
  const digest = computeHash(content).slice(0, 10);
  const sceneDigest = computeHash(`${safeBaseName}\n${content}`).slice(0, 10);
  const sceneLabel = `${safeBaseName} ${digest}`;
  const fileName = `${sceneLabel}.txt`;
  const romanRoot = getProjectSectionPath('roman');
  const targetPath = joinPathSegmentsWithinRoot(romanRoot, ['Imported', fileName], { resolveSymlinks: false });
  return {
    mode: 'create-only',
    entries: [
      {
        sceneId: `scene-${sceneDigest}`,
        title: safeBaseName,
        contentTextHash: digest,
        expectedLabel: sceneLabel,
        path: targetPath,
        content,
      },
    ],
  };
}

function buildMarkdownImportPreviewEnvelope(payload, scene, lossReport, markdownText, ioRecovery = null) {
  const previewResult = {
    schemaVersion: MARKDOWN_IMPORT_PREVIEW_SCHEMA,
    type: MARKDOWN_IMPORT_PREVIEW_TYPE,
    status: 'preview',
    writeEffects: false,
    sourceName: payload && typeof payload.sourceName === 'string' ? payload.sourceName : '',
    sourcePath: payload && typeof payload.sourcePath === 'string' ? payload.sourcePath : '',
    scene,
    lossReport: lossReport && typeof lossReport === 'object'
      ? lossReport
      : { count: 0, items: [] },
    safeCreatePlan: buildMarkdownImportSafeCreatePlan(payload, markdownText),
  };
  if (ioRecovery && typeof ioRecovery === 'object' && !Array.isArray(ioRecovery)) {
    previewResult.recovery = ioRecovery;
  }
  return previewResult;
}

function normalizeMarkdownExportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (!payload.scene || typeof payload.scene !== 'object' || Array.isArray(payload.scene)) return null;
  const normalized = {
    scene: payload.scene,
    outPath: typeof payload.outPath === 'string' ? payload.outPath.trim() : '',
    saveAs: payload.saveAs === true,
    defaultName: typeof payload.defaultName === 'string' ? payload.defaultName.trim() : '',
    snapshotLimit: Number.isInteger(payload.snapshotLimit) && payload.snapshotLimit >= 1
      ? payload.snapshotLimit
      : 3,
    safetyMode: normalizeMarkdownSafetyMode(payload.safetyMode),
    limits: payload.limits && typeof payload.limits === 'object' && !Array.isArray(payload.limits)
      ? payload.limits
      : {},
  };
  const pathGuard = sanitizePathFields(normalized, ['outPath'], { mode: 'any' });
  if (!pathGuard.ok) {
    return {
      ...normalized,
      pathBoundaryError: pathGuard,
    };
  }
  return pathGuard.payload;
}

function normalizeExportPayload(payload) {
  if (payload === undefined || payload === null) {
    return {
      requestId: EXPORT_DOCX_DEFAULT_REQUEST_ID,
      outPath: '',
      outDir: '',
      bufferSource: '',
      options: {},
    };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0
    ? payload.requestId.trim()
    : EXPORT_DOCX_DEFAULT_REQUEST_ID;
  const outPath = typeof payload.outPath === 'string' ? payload.outPath.trim() : '';
  const outDir = typeof payload.outDir === 'string' ? payload.outDir.trim() : '';
  const bufferSource = typeof payload.bufferSource === 'string' ? payload.bufferSource : '';
  const options = payload.options && typeof payload.options === 'object' && !Array.isArray(payload.options)
    ? payload.options
    : {};

  const normalized = {
    requestId,
    outPath,
    outDir,
    bufferSource,
    options,
  };
  const pathGuard = sanitizePathFields(normalized, ['outPath', 'outDir'], { mode: 'any' });
  if (!pathGuard.ok) {
    return {
      ...normalized,
      pathBoundaryError: pathGuard,
    };
  }
  return pathGuard.payload;
}

function normalizeDocxExportPath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) return '';
  const raw = filePath.trim();
  return raw.toLowerCase().endsWith('.docx') ? raw : `${raw}.docx`;
}

function normalizeMarkdownExportPath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) return '';
  const raw = filePath.trim();
  return /\.(md|markdown)$/i.test(raw) ? raw : `${raw}.md`;
}

function buildMarkdownExportDefaultPath(payload) {
  const safeDefaultName = sanitizeFilename(
    typeof payload.defaultName === 'string' && payload.defaultName.trim()
      ? payload.defaultName.trim()
      : 'export',
  );
  const defaultBase = currentFilePath
    ? currentFilePath.replace(/\.[^/.]+$/i, '')
    : path.join(fileManager.getDocumentsPath(), safeDefaultName);
  return normalizeMarkdownExportPath(defaultBase);
}

async function resolveMarkdownExportPath(payload) {
  const fromPayload = normalizeMarkdownExportPath(payload.outPath);
  if (fromPayload) return { canceled: false, outPath: fromPayload };
  if (payload.saveAs !== true) return { canceled: false, outPath: '' };
  if (!mainWindow) {
    return {
      canceled: false,
      error: {
        code: 'E_MD_EXPORT_SAVE_DIALOG_UNAVAILABLE',
        reason: 'save_dialog_unavailable',
      },
    };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Экспорт Markdown v1',
    defaultPath: buildMarkdownExportDefaultPath(payload),
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Все файлы', extensions: ['*'] },
    ],
  });
  if (result.canceled) return { canceled: true, outPath: '' };

  const outPath = normalizeMarkdownExportPath(result.filePath);
  if (!outPath) {
    return {
      canceled: false,
      error: {
        code: 'E_MD_EXPORT_PATH_REQUIRED',
        reason: 'export_path_required',
      },
    };
  }
  const pathGuard = sanitizePathFields({ outPath }, ['outPath'], { mode: 'any' });
  if (!pathGuard.ok) {
    return {
      canceled: false,
      pathBoundaryError: pathGuard,
    };
  }
  return { canceled: false, outPath: pathGuard.payload.outPath };
}

async function resolveDocxExportPath(payload) {
  const fromPayload = normalizeDocxExportPath(payload.outPath);
  if (fromPayload) return fromPayload;

  const defaultBase = currentFilePath
    ? currentFilePath.replace(/\.[^/.]+$/i, '')
    : path.join(fileManager.getDocumentsPath(), 'export');
  const defaultPath = normalizeDocxExportPath(defaultBase);

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Экспорт DOCX (MIN)',
    defaultPath,
    filters: [{ name: 'DOCX', extensions: ['docx'] }],
  });
  if (result.canceled) return '';
  return normalizeDocxExportPath(result.filePath);
}

async function buildDocxMinBuffer(editorSnapshot) {
  const [
    docxPageSetupBindModule,
    semanticMappingModule,
    styleMapModule,
  ] = await Promise.all([
    loadDocxPageSetupBindModule(),
    loadSemanticMappingModule(),
    loadStyleMapModule(),
  ]);
  return buildDocxMinBufferCore(editorSnapshot, {
    docxPageSetupBindModule,
    semanticMappingModule,
    styleMapModule,
  });
}

async function handleExportDocxMin(payloadRaw) {
  return runDocxMinExport(payloadRaw, {
    normalizeExportPayload,
    makeTypedExportError,
    buildPathBoundaryDetails,
    resolveDocxExportPath,
    readCanonicalExportSnapshot,
    buildDocxMinBuffer,
    queueDiskOperation,
    writeBufferAtomic,
    updateStatus,
  });
}

async function handleImportMarkdownV1(payloadRaw) {
  const payload = normalizeMarkdownImportPayload(payloadRaw);
  if (!payload) {
    return makeTypedMarkdownError(IMPORT_MARKDOWN_V1_CHANNEL, 'E_MD_PAYLOAD_INVALID', 'import_payload_invalid');
  }
  if (payload.pathBoundaryError) {
    return makeTypedMarkdownError(
      IMPORT_MARKDOWN_V1_CHANNEL,
      'E_PATH_BOUNDARY_VIOLATION',
      'path_boundary_violation',
      buildPathBoundaryDetails(payload.pathBoundaryError),
    );
  }

  if (payload.safeCreate === true) {
    try {
      await ensureProjectStructure();
      const projectBinding = await resolveProjectBindingForFile(getProjectSectionPath('roman'));
      const safeCreateResult = await applyMarkdownImportSafeCreate(
        {
          previewPayload: payload.previewPayload,
        },
        {
          projectRoot: getProjectRootPath(),
          romanRoot: getProjectSectionPath('roman'),
          projectId: projectBinding && typeof projectBinding.projectId === 'string'
            ? projectBinding.projectId
            : '',
          previewSchemaVersion: MARKDOWN_IMPORT_PREVIEW_SCHEMA,
          reservedTopLevelRomanNames: [...ROMAN_SECTION_FILENAME_SET],
          queueDiskOperation,
          operationLabel: 'safe create import scene batch',
          writeBatchAtomic: writeFlowSceneBatchAtomic,
        },
      );
      if (safeCreateResult.ok) {
        return {
          ok: 1,
          safeCreate: true,
          created: true,
          createdSceneIds: Array.isArray(safeCreateResult.value.createdSceneIds)
            ? safeCreateResult.value.createdSceneIds
            : [],
          receipt: safeCreateResult.value.receipt,
        };
      }
      return makeTypedMarkdownError(
        IMPORT_MARKDOWN_V1_CHANNEL,
        safeCreateResult.error && typeof safeCreateResult.error.code === 'string'
          ? safeCreateResult.error.code
          : 'MDV1_SAFE_CREATE_WRITE_FAIL',
        safeCreateResult.error && typeof safeCreateResult.error.reason === 'string'
          ? safeCreateResult.error.reason
          : 'import_safe_create_failed',
        safeCreateResult.error && safeCreateResult.error.details && typeof safeCreateResult.error.details === 'object'
          ? safeCreateResult.error.details
          : {},
      );
    } catch (error) {
      return makeTypedMarkdownError(
        IMPORT_MARKDOWN_V1_CHANNEL,
        'MDV1_SAFE_CREATE_WRITE_FAIL',
        'import_safe_create_failed',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }
  }

  let transform;
  try {
    transform = await loadMarkdownTransformModule();
  } catch (error) {
    return makeTypedMarkdownError(
      IMPORT_MARKDOWN_V1_CHANNEL,
      'E_MD_TRANSFORM_LOAD_FAILED',
      'transform_module_load_failed',
      { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
    );
  }

  try {
    let markdownText = payload.text;
    let ioRecovery = null;
    if (!markdownText && payload.sourcePath) {
      const markdownIo = await loadMarkdownIoModule();
      const limits = typeof transform.normalizeLimits === 'function'
        ? transform.normalizeLimits(payload.limits)
        : { maxInputBytes: 1024 * 1024 };
      const loaded = await markdownIo.readMarkdownWithRecovery(payload.sourcePath, {
        maxInputBytes: limits.maxInputBytes,
      });
      markdownText = loaded.text;
      if (loaded && loaded.recoveredFromSnapshot === true) {
        ioRecovery = {
          sourceKind: loaded.sourceKind,
          snapshotPath: loaded.snapshotPath,
          recoveryAction: loaded.recoveryAction,
          primaryError: loaded.primaryError,
        };
      }
    }

    const scene = transform.parseMarkdownV1(markdownText, { limits: payload.limits });
    const lossReport = scene && scene.lossReport && typeof scene.lossReport === 'object'
      ? scene.lossReport
      : { count: 0, items: [] };
    const out = {
      ok: 1,
      scene,
      preview: payload.preview === true,
      sourceName: payload.sourceName,
      lossReport,
    };
    if (payload.preview === true) {
      out.previewResult = buildMarkdownImportPreviewEnvelope(payload, scene, lossReport, markdownText, ioRecovery);
    }
    if (ioRecovery) {
      out.recovery = ioRecovery;
    }
    return out;
  } catch (error) {
    let logRecord = null;
    let logPath = '';
    if (payload.preview !== true) {
      try {
        const markdownIo = await loadMarkdownIoModule();
        const log = await appendMarkdownReliabilityLog(markdownIo, {
          op: IMPORT_MARKDOWN_V1_CHANNEL,
          code: error && typeof error.code === 'string' ? error.code : 'E_MD_IMPORT_FAILED',
          reason: error && typeof error.reason === 'string' ? error.reason : 'import_failed',
          sourcePath: payload.sourcePath,
        });
        logRecord = log.logRecord;
        logPath = log.logPath;
      } catch {
        logRecord = null;
        logPath = '';
      }
    }
    return makeTypedMarkdownError(
      IMPORT_MARKDOWN_V1_CHANNEL,
      error && typeof error.code === 'string' ? error.code : 'E_MD_IMPORT_FAILED',
      error && typeof error.reason === 'string' ? error.reason : 'import_failed',
      {
        ...(error && error.details && typeof error.details === 'object' && !Array.isArray(error.details)
          ? error.details
          : {}),
        ...(logRecord ? { logRecord } : {}),
        ...(logPath ? { logPath } : {}),
      },
    );
  }
}

async function handleExportMarkdownV1(payloadRaw) {
  const payload = normalizeMarkdownExportPayload(payloadRaw);
  if (!payload) {
    return makeTypedMarkdownError(EXPORT_MARKDOWN_V1_CHANNEL, 'E_MD_PAYLOAD_INVALID', 'export_payload_invalid');
  }
  if (payload.pathBoundaryError) {
    return makeTypedMarkdownError(
      EXPORT_MARKDOWN_V1_CHANNEL,
      'E_PATH_BOUNDARY_VIOLATION',
      'path_boundary_violation',
      buildPathBoundaryDetails(payload.pathBoundaryError),
    );
  }

  let resolvedPath;
  try {
    resolvedPath = await resolveMarkdownExportPath(payload);
  } catch (error) {
    return makeTypedMarkdownError(
      EXPORT_MARKDOWN_V1_CHANNEL,
      'E_MD_EXPORT_SAVE_DIALOG_FAILED',
      'save_dialog_failed',
      { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
    );
  }
  if (resolvedPath && resolvedPath.canceled === true) {
    return {
      ok: 1,
      canceled: true,
      outPath: '',
      bytesWritten: 0,
      snapshotCreated: false,
      lossReport: { count: 0, items: [] },
    };
  }
  if (resolvedPath && resolvedPath.error) {
    return makeTypedMarkdownError(
      EXPORT_MARKDOWN_V1_CHANNEL,
      resolvedPath.error.code,
      resolvedPath.error.reason,
    );
  }
  if (resolvedPath && resolvedPath.pathBoundaryError) {
    return makeTypedMarkdownError(
      EXPORT_MARKDOWN_V1_CHANNEL,
      'E_PATH_BOUNDARY_VIOLATION',
      'path_boundary_violation',
      buildPathBoundaryDetails(resolvedPath.pathBoundaryError),
    );
  }
  const outPath = resolvedPath && typeof resolvedPath.outPath === 'string'
    ? resolvedPath.outPath
    : '';

  let transform;
  try {
    transform = await loadMarkdownTransformModule();
  } catch (error) {
    return makeTypedMarkdownError(
      EXPORT_MARKDOWN_V1_CHANNEL,
      'E_MD_TRANSFORM_LOAD_FAILED',
      'transform_module_load_failed',
      { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
    );
  }

  try {
    const markdown = transform.serializeMarkdownV1(payload.scene);
    const parsed = transform.parseMarkdownV1(markdown, { limits: payload.limits });

    let writeResult = null;
    if (outPath) {
      const markdownIo = await loadMarkdownIoModule();
      writeResult = await queueDiskOperation(
        () => markdownIo.writeMarkdownWithRecovery(outPath, markdown, {
          maxSnapshots: payload.snapshotLimit,
          safetyMode: payload.safetyMode,
        }),
        'export markdown v1',
      );
    }

    return {
      ok: 1,
      markdown,
      safetyMode: payload.safetyMode,
      outPath: writeResult && typeof writeResult.outPath === 'string' ? writeResult.outPath : '',
      bytesWritten: writeResult && Number.isInteger(writeResult.bytesWritten) ? writeResult.bytesWritten : 0,
      snapshotCreated: writeResult ? Boolean(writeResult.snapshotCreated) : false,
      snapshotPath: writeResult && typeof writeResult.snapshotPath === 'string' ? writeResult.snapshotPath : '',
      purgedSnapshots: writeResult && Array.isArray(writeResult.purgedSnapshots) ? writeResult.purgedSnapshots : [],
      lossReport: parsed && parsed.lossReport && typeof parsed.lossReport === 'object'
        ? parsed.lossReport
        : { count: 0, items: [] },
    };
  } catch (error) {
    let logRecord = null;
    let logPath = '';
    const mappedCode = error && typeof error.code === 'string' ? error.code : 'E_MD_EXPORT_FAILED';
    const mappedReason = error && typeof error.reason === 'string' ? error.reason : 'export_failed';
    const recovery = getMarkdownRecoveryGuidance(mapMarkdownErrorCode(mappedCode, mappedReason));
    try {
      const markdownIo = await loadMarkdownIoModule();
      const log = await appendMarkdownReliabilityLog(markdownIo, {
        op: EXPORT_MARKDOWN_V1_CHANNEL,
        code: mappedCode,
        reason: mappedReason,
        safetyMode: payload.safetyMode,
        targetPath: outPath,
        snapshotPath: error && error.details && typeof error.details === 'object'
          ? error.details.snapshotPath
          : '',
        recoveryActions: recovery ? recovery.recoveryActions : [],
      });
      logRecord = log.logRecord;
      logPath = log.logPath;
    } catch {
      logRecord = null;
      logPath = '';
    }
    return makeTypedMarkdownError(
      EXPORT_MARKDOWN_V1_CHANNEL,
      mappedCode,
      mappedReason,
      {
        ...(error && error.details && typeof error.details === 'object' && !Array.isArray(error.details)
          ? error.details
          : {}),
        safetyMode: payload.safetyMode,
        ...(logRecord ? { logRecord } : {}),
        ...(logPath ? { logPath } : {}),
      },
    );
  }
}

function makeFlowModeError(op, code, reason, details = {}) {
  return {
    ok: 0,
    error: {
      op,
      code,
      reason,
      details: details && typeof details === 'object' && !Array.isArray(details) ? details : {},
    },
  };
}

async function getFlowBatchGuard(projectRoot) {
  const staleMarkers = await readFlowSceneBatchMarkers(projectRoot);
  return {
    hasBlockingBatchState: staleMarkers.length > 0,
    staleMarkers,
  };
}

async function handleFlowOpenV1() {
  try {
    await ensureProjectStructure();
    const projectRoot = getProjectRootPath();
    const batchGuard = await getFlowBatchGuard(projectRoot);
    if (batchGuard.hasBlockingBatchState) {
      return makeFlowModeError(FLOW_OPEN_V1_CHANNEL, 'M7_FLOW_BATCH_STALE', 'flow_open_batch_recovery_required', {
        staleMarkers: batchGuard.staleMarkers,
      });
    }
    const romanRoot = await buildRomanTree();
    const flowNodes = collectFlowEditableNodes(romanRoot, []);

    const scenes = [];
    for (const node of flowNodes) {
      const filePath = node.path;
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          const created = await queueDiskOperation(
            () => fileManager.writeFileAtomic(filePath, ''),
            'create flow scene file',
          );
          if (!created.success) {
            return makeFlowModeError(FLOW_OPEN_V1_CHANNEL, 'M7_FLOW_IO_CREATE_FAIL', 'flow_open_create_failed', {
              path: filePath,
            });
          }
        } else {
          return makeFlowModeError(FLOW_OPEN_V1_CHANNEL, 'M7_FLOW_IO_READ_FAIL', 'flow_open_read_failed', {
            path: filePath,
            message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
          });
        }
      }

      scenes.push({
        path: filePath,
        title: node.title,
        kind: node.kind,
        content: normalizeFlowTextInput(content),
      });
    }

    return {
      ok: 1,
      scenes,
    };
  } catch (error) {
    return makeFlowModeError(FLOW_OPEN_V1_CHANNEL, 'M7_FLOW_INTERNAL_ERROR', 'flow_open_failed', {
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    });
  }
}

async function handleFlowSaveV1(payloadRaw) {
  const payload = payloadRaw && typeof payloadRaw === 'object' && !Array.isArray(payloadRaw) ? payloadRaw : null;
  const incomingScenes = payload && Array.isArray(payload.scenes) ? payload.scenes : null;
  if (!incomingScenes) {
    return makeFlowModeError(FLOW_SAVE_V1_CHANNEL, 'M7_FLOW_INVALID_PAYLOAD', 'flow_save_payload_invalid');
  }

  try {
    await ensureProjectStructure();
    const projectRoot = getProjectRootPath();
    const batchGuard = await getFlowBatchGuard(projectRoot);
    if (batchGuard.hasBlockingBatchState) {
      return makeFlowModeError(FLOW_SAVE_V1_CHANNEL, 'M7_FLOW_BATCH_STALE', 'flow_save_batch_recovery_required', {
        staleMarkers: batchGuard.staleMarkers,
      });
    }
    const romanRoot = await buildRomanTree();
    const allowedNodes = collectFlowEditableNodes(romanRoot, []);
    const allowed = new Map(allowedNodes.map((item) => [item.path, item]));

    const normalizedScenes = [];
    for (const item of incomingScenes) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return makeFlowModeError(FLOW_SAVE_V1_CHANNEL, 'M7_FLOW_INVALID_SCENE_ITEM', 'flow_save_scene_invalid');
      }
      const scenePath = typeof item.path === 'string' ? item.path : '';
      const scenePathGuard = sanitizePayloadWithinProjectRoot({ path: scenePath }, ['path']);
      if (!scenePathGuard.ok || !scenePathGuard.payload) {
        return makeFlowModeError(
          FLOW_SAVE_V1_CHANNEL,
          'E_PATH_BOUNDARY_VIOLATION',
          'flow_save_path_boundary_violation',
          {
            path: scenePath,
            failReason: scenePathGuard.pathGuard && typeof scenePathGuard.pathGuard.failReason === 'string'
              ? scenePathGuard.pathGuard.failReason
              : 'PATH_BOUNDARY_VIOLATION',
          },
        );
      }
      const safeScenePath = scenePathGuard.payload.path;
      if (!safeScenePath || !allowed.has(safeScenePath)) {
        return makeFlowModeError(FLOW_SAVE_V1_CHANNEL, 'M7_FLOW_PATH_FORBIDDEN', 'flow_save_path_forbidden', {
          path: safeScenePath || scenePath,
        });
      }
      normalizedScenes.push({
        path: safeScenePath,
        content: normalizeFlowTextInput(item.content),
      });
    }

    const writeResult = await queueDiskOperation(
      () => writeFlowSceneBatchAtomic({
        projectRoot,
        entries: normalizedScenes,
      }),
      'save flow scene batch',
    );
    if (!writeResult || writeResult.ok !== true) {
      const errorCode = writeResult && writeResult.error && typeof writeResult.error.code === 'string'
        ? writeResult.error.code
        : 'M7_FLOW_IO_WRITE_FAIL';
      const errorReason = writeResult && writeResult.error && typeof writeResult.error.reason === 'string'
        ? writeResult.error.reason
        : 'flow_save_write_failed';
      const errorDetails = writeResult && writeResult.error && writeResult.error.details && typeof writeResult.error.details === 'object'
        ? writeResult.error.details
        : {};
      return makeFlowModeError(FLOW_SAVE_V1_CHANNEL, errorCode, errorReason, errorDetails);
    }

    updateStatus('Flow mode сохранен');
    return {
      ok: 1,
      savedCount: normalizedScenes.length,
    };
  } catch (error) {
    return makeFlowModeError(FLOW_SAVE_V1_CHANNEL, 'M7_FLOW_INTERNAL_ERROR', 'flow_save_failed', {
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    });
  }
}

function extractNumericPrefix(name) {
  const match = /^(\d+)_/.exec(name);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function stripNumericPrefix(name) {
  return name.replace(/^\d+_/, '');
}

function stripTxtExtension(name) {
  return name.replace(/\.txt$/i, '');
}

function getDisplayNameForEntry(entryName) {
  return stripNumericPrefix(stripTxtExtension(entryName));
}

function normalizeFlowTextInput(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function collectFlowEditableNodes(node, output = []) {
  if (!node || typeof node !== 'object') return output;
  const kind = typeof node.kind === 'string' ? node.kind : '';
  const nodePath = typeof node.path === 'string' ? node.path : '';
  if (
    nodePath &&
    nodePath.toLowerCase().endsWith('.txt') &&
    (kind === 'roman-section' || kind === 'scene' || kind === 'chapter-file')
  ) {
    output.push({
      path: nodePath,
      title: typeof node.label === 'string' ? node.label : getDisplayNameForEntry(path.basename(nodePath)),
      kind,
    });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectFlowEditableNodes(child, output);
    }
  }
  return output;
}

function formatPrefixedName(baseName, index) {
  const safeBase = sanitizeFilename(baseName);
  const prefix = String(index).padStart(2, '0');
  return `${prefix}_${safeBase}`;
}

function isPathInside(parentPath, childPath) {
  return isPathInsideBoundary(parentPath, childPath, { resolveSymlinks: false });
}

function makePathBoundaryViolationResult(pathGuard) {
  return {
    ok: false,
    error: 'Path boundary violation',
    code: 'E_PATH_BOUNDARY_VIOLATION',
    failSignal: 'E_PATH_BOUNDARY_VIOLATION',
    failReason: pathGuard && typeof pathGuard.failReason === 'string'
      ? pathGuard.failReason
      : 'PATH_BOUNDARY_VIOLATION',
  };
}

function sanitizePayloadWithinProjectRoot(payload, pathFieldNames) {
  const projectRoot = getProjectRootPath();
  const pathGuard = sanitizePathFieldsWithinRoot(payload, pathFieldNames, projectRoot, {
    mode: 'any',
    resolveSymlinks: true,
  });
  if (!pathGuard.ok || !pathGuard.payload) {
    return {
      ok: false,
      payload: null,
      pathGuard,
      error: makePathBoundaryViolationResult(pathGuard),
    };
  }
  return {
    ok: true,
    payload: pathGuard.payload,
    pathGuard,
    error: null,
  };
}

// Проверка существования файла
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureProjectStructure(projectName = DEFAULT_PROJECT_NAME) {
  const projectRoot = getProjectRootPath(projectName);
  const romanPath = getProjectSectionPath('roman', projectName);
  const mindmapPath = getProjectSectionPath('mindmap', projectName);
  const printPath = getProjectSectionPath('print', projectName);
  const materialsPath = getProjectSectionPath('materials', projectName);
  const referencePath = getProjectSectionPath('reference', projectName);
  const trashPath = getProjectSectionPath('trash', projectName);
  const backupsPath = getProjectSectionPath('backups', projectName);

  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(romanPath, { recursive: true });
  await fs.mkdir(mindmapPath, { recursive: true });
  await fs.mkdir(printPath, { recursive: true });
  await fs.mkdir(materialsPath, { recursive: true });
  await fs.mkdir(referencePath, { recursive: true });
  await fs.mkdir(trashPath, { recursive: true });
  await fs.mkdir(backupsPath, { recursive: true });

  for (const section of MATERIALS_SECTIONS) {
    await fs.mkdir(joinPathSegmentsWithinRoot(materialsPath, [section.dirName], { resolveSymlinks: false }), {
      recursive: true,
    });
  }

  for (const section of REFERENCE_SECTIONS) {
    await fs.mkdir(joinPathSegmentsWithinRoot(referencePath, [section.dirName], { resolveSymlinks: false }), {
      recursive: true,
    });
  }

  await ensureProjectManifest(projectName);

  return projectRoot;
}

async function readDirectoryEntries(folderPath) {
  let entries = [];
  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch (error) {
    logDevError('readDirectoryEntries', error);
    return [];
  }

  return entries
    .filter((entry) => entry.name && !entry.name.startsWith('.'))
    .map((entry) => ({
      name: entry.name,
      path: joinPathSegmentsWithinRoot(folderPath, [entry.name], { resolveSymlinks: false }),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      prefix: extractNumericPrefix(entry.name),
      baseName: getDisplayNameForEntry(entry.name)
    }))
    .sort((a, b) => {
      const prefixA = a.prefix ?? Number.MAX_SAFE_INTEGER;
      const prefixB = b.prefix ?? Number.MAX_SAFE_INTEGER;
      if (prefixA !== prefixB) {
        return prefixA - prefixB;
      }
      return a.baseName.localeCompare(b.baseName, 'ru');
    });
}

function buildNode({ name, label, kind, nodePath, children = [], ...metadata }) {
  return {
    ...metadata,
    id: nodePath,
    name,
    label,
    kind,
    path: nodePath,
    children
  };
}

async function buildImportedRomanTree(romanPath) {
  const importedPath = joinPathSegmentsWithinRoot(romanPath, ['Imported'], {
    resolveSymlinks: false,
  });
  if (!(await fileExists(importedPath))) {
    return null;
  }

  const entries = await readDirectoryEntries(importedPath);
  const children = entries
    .filter((entry) => entry.isFile && entry.name.toLowerCase().endsWith('.txt'))
    .map((entry) => buildNode({
      name: entry.baseName,
      label: entry.baseName,
      kind: 'scene',
      nodePath: entry.path,
      children: [],
    }));

  if (children.length === 0) {
    return null;
  }

  return buildNode({
    name: 'Imported',
    label: 'Imported',
    kind: 'chapter-folder',
    nodePath: importedPath,
    children,
    imported: true,
  });
}

async function buildRomanTree(projectName = DEFAULT_PROJECT_NAME) {
  const romanPath = getProjectSectionPath('roman', projectName);
  const childNodes = ROMAN_SECTION_LABELS.map((label) =>
    buildNode({
      name: label,
      label,
      kind: 'roman-section',
      nodePath: joinPathSegmentsWithinRoot(romanPath, [`${sanitizeFilename(label)}.txt`], {
        resolveSymlinks: false,
      }),
      children: []
    })
  );
  const importedNode = await buildImportedRomanTree(romanPath);
  if (importedNode) {
    childNodes.push(importedNode);
  }

  return buildNode({
    name: 'Роман',
    label: 'Роман',
    kind: 'roman-root',
    nodePath: romanPath,
    children: childNodes
  });
}

async function buildMindMapTree(projectName = DEFAULT_PROJECT_NAME) {
  const mindmapPath = getProjectSectionPath('mindmap', projectName);
  const childNodes = ROMAN_MIND_MAP_SECTION_LABELS.map((label) =>
    buildNode({
      name: label,
      label,
      kind: 'mindmap-section',
      nodePath: joinPathSegmentsWithinRoot(mindmapPath, [`${sanitizeFilename(label)}.txt`], {
        resolveSymlinks: false,
      }),
      children: []
    })
  );

  return buildNode({
    name: 'Mind map',
    label: 'Mind map',
    kind: 'mindmap-root',
    nodePath: mindmapPath,
    children: childNodes
  });
}

async function buildPrintTree(projectName = DEFAULT_PROJECT_NAME) {
  const printPath = getProjectSectionPath('print', projectName);
  const childNodes = PRINT_SECTION_LABELS.map((label) =>
    buildNode({
      name: label,
      label,
      kind: 'print-section',
      nodePath: joinPathSegmentsWithinRoot(printPath, [`${sanitizeFilename(label)}.txt`], {
        resolveSymlinks: false,
      }),
      children: []
    })
  );

  return buildNode({
    name: 'Печать',
    label: 'Печать',
    kind: 'print-root',
    nodePath: printPath,
    children: childNodes
  });
}

async function buildGenericTree(rootPath, kind) {
  const entries = await readDirectoryEntries(rootPath);
  const nodes = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      const children = await buildGenericTree(entry.path, kind);
      nodes.push(
        buildNode({
          name: entry.baseName,
          label: entry.baseName,
          kind: 'folder',
          nodePath: entry.path,
          children: children.children || []
        })
      );
      continue;
    }
    if (entry.isFile && entry.name.toLowerCase().endsWith('.txt')) {
      nodes.push(
        buildNode({
          name: entry.baseName,
          label: entry.baseName,
          kind: kind === 'materials' ? 'material' : 'reference',
          nodePath: entry.path,
          children: []
        })
      );
    }
  }

  return buildNode({
    name: rootPath,
    label: path.basename(rootPath),
    kind: 'folder',
    nodePath: rootPath,
    children: nodes
  });
}

async function buildMaterialsTree(projectName = DEFAULT_PROJECT_NAME) {
  const materialsPath = getProjectSectionPath('materials', projectName);
  const categoryNodes = [];
  for (const section of MATERIALS_SECTIONS) {
    const folderPath = joinPathSegmentsWithinRoot(materialsPath, [section.dirName], { resolveSymlinks: false });
    const subtree = await buildGenericTree(folderPath, 'materials');
    categoryNodes.push(
      buildNode({
        name: section.label,
        label: section.label,
        kind: 'materials-category',
        nodePath: folderPath,
        children: subtree.children || []
      })
    );
  }

  return buildNode({
    name: 'Материалы',
    label: 'Материалы',
    kind: 'materials-root',
    nodePath: materialsPath,
    children: categoryNodes
  });
}

async function buildReferenceTree(projectName = DEFAULT_PROJECT_NAME) {
  const referencePath = getProjectSectionPath('reference', projectName);
  const categoryNodes = [];
  for (const section of REFERENCE_SECTIONS) {
    const folderPath = joinPathSegmentsWithinRoot(referencePath, [section.dirName], { resolveSymlinks: false });
    const subtree = await buildGenericTree(folderPath, 'reference');
    categoryNodes.push(
      buildNode({
        name: section.label,
        label: section.label,
        kind: 'reference-category',
        nodePath: folderPath,
        children: subtree.children || []
      })
    );
  }

  return buildNode({
    name: 'Справочник',
    label: 'Справочник',
    kind: 'reference-root',
    nodePath: referencePath,
    children: categoryNodes
  });
}

function getDocumentContextFromPath(filePath) {
  const projectRoot = getProjectRootPath();
  const relative = path.relative(projectRoot, filePath);
  const baseTitle = getDisplayNameForEntry(path.basename(filePath));
  const lowerBaseName = path.basename(filePath).toLowerCase();

  if (!relative || relative.startsWith('..')) {
    return { title: baseTitle, kind: 'external', metaEnabled: false };
  }

  const parts = relative.split(path.sep);
  if (parts[0] === PROJECT_SUBFOLDERS.roman) {
    if (parts.length >= 2) {
      if (parts.length === 2 && parts[1].toLowerCase().endsWith('.txt')) {
        const normalizedName = sanitizeFilename(stripTxtExtension(parts[1])).toLowerCase();
        if (ROMAN_SECTION_FILENAME_SET.has(normalizedName)) {
          return { title: baseTitle, kind: 'roman-section', metaEnabled: false };
        }
        return { title: baseTitle, kind: 'chapter-file', metaEnabled: true };
      }
      if (
        parts.length === 3
        && parts[1].toLowerCase() === 'imported'
        && parts[2].toLowerCase().endsWith('.txt')
      ) {
        return { title: baseTitle, kind: 'scene', metaEnabled: true };
      }
      if (parts.length === 3 && parts[2].toLowerCase().endsWith('.txt')) {
        return { title: baseTitle, kind: 'chapter-file', metaEnabled: true };
      }
      if (parts.length >= 4 && parts[3].toLowerCase().endsWith('.txt')) {
        return { title: baseTitle, kind: 'scene', metaEnabled: true };
      }
    }
  }

  if (parts[0] === PROJECT_SUBFOLDERS.mindmap) {
    if (parts.length === 2 && parts[1].toLowerCase().endsWith('.txt')) {
      return { title: baseTitle, kind: 'mindmap-section', metaEnabled: false };
    }
  }

  if (parts[0] === PROJECT_SUBFOLDERS.print) {
    if (parts.length === 2 && parts[1].toLowerCase().endsWith('.txt')) {
      return { title: baseTitle, kind: 'print-section', metaEnabled: false };
    }
  }

  if (parts[0] === PROJECT_SUBFOLDERS.materials) {
    if (lowerBaseName === '.index.txt' && parts.length >= 3) {
      const category = MATERIALS_SECTIONS.find((section) => section.dirName === parts[1]);
      return { title: category ? category.label : baseTitle, kind: 'material', metaEnabled: false };
    }
    return { title: baseTitle, kind: 'material', metaEnabled: false };
  }

  if (parts[0] === PROJECT_SUBFOLDERS.reference) {
    if (lowerBaseName === '.index.txt' && parts.length >= 3) {
      const category = REFERENCE_SECTIONS.find((section) => section.dirName === parts[1]);
      return { title: category ? category.label : baseTitle, kind: 'reference', metaEnabled: false };
    }
    return { title: baseTitle, kind: 'reference', metaEnabled: false };
  }

  return { title: baseTitle, kind: 'external', metaEnabled: false };
}

function getBackupBasePathForFile(filePath) {
  if (!filePath) return null;
  const projectRoot = getProjectRootPath();
  return isPathInside(projectRoot, filePath) ? projectRoot : null;
}

async function safeRenameSequence(renames) {
  const timestamp = Date.now();
  const tempSuffix = `.tmp-${timestamp}`;
  const tempMappings = [];
  for (const rename of renames) {
    const tempPath = `${rename.from}${tempSuffix}`;
    await fs.rename(rename.from, tempPath);
    tempMappings.push({ tempPath, finalPath: rename.to });
  }
  for (const mapping of tempMappings) {
    await fs.rename(mapping.tempPath, mapping.finalPath);
  }
}

async function reorderEntriesWithPrefixes(parentPath, orderedEntries) {
  const renames = [];
  orderedEntries.forEach((entry, index) => {
    const baseName = entry.baseName;
    const prefixed = formatPrefixedName(baseName, index + 1);
    const finalName = entry.isFile ? `${prefixed}.txt` : prefixed;
    const finalPath = joinPathSegmentsWithinRoot(parentPath, [finalName], { resolveSymlinks: false });
    if (entry.path !== finalPath) {
      renames.push({ from: entry.path, to: finalPath });
    }
    entry.nextPath = finalPath;
  });

  if (!renames.length) {
    return orderedEntries;
  }

  await safeRenameSequence(renames);
  return orderedEntries;
}

// Автоматическое открытие последнего файла
async function openLastFile() {
  if (!mainWindow) return 'noFile';
  
  const lastFilePath = await loadLastFile();
  if (!lastFilePath) return 'noFile';
  if (!isAllowedFilePath(lastFilePath)) return 'noFile';
  
  const exists = await fileExists(lastFilePath);
  if (!exists) return 'noFile';
  
  const fileResult = await fileManager.readFile(lastFilePath);
    if (fileResult.success) {
      currentFilePath = lastFilePath;
      await saveLastFile();
      const context = getDocumentContextFromPath(lastFilePath);
      sendEditorText(await attachProjectIdToEditorPayload({
        content: fileResult.content,
        title: context.title,
        path: lastFilePath,
        kind: context.kind,
        metaEnabled: context.metaEnabled
      }));
      setDirtyState(false);
      const contentHash = computeHash(fileResult.content);
      lastAutosaveHash = contentHash;
      backupHashes.set(lastFilePath, contentHash);
      updateStatus('Готово');
      return 'loaded';
    }

  updateStatus('Ошибка');
  return 'error';
}

// Применение сохранённого размера шрифта
async function loadSavedFontSize() {
  if (!mainWindow) return;
  
  try {
    const settings = await loadSettings();
    if (Number.isFinite(settings.fontSize)) {
      currentFontSize = clampFontSize(settings.fontSize);
    }
  } catch (error) {
    // Тихая обработка ошибок
  }

  sendEditorFontSize(currentFontSize);
}

async function restoreAutosaveIfExists() {
  if (!mainWindow) return false;
  await ensureAutosaveDirectory();

  const autosavePath = getAutosavePath();
  try {
    const content = await fs.readFile(autosavePath, 'utf-8');
    if (!content) {
      return false;
    }

    sendEditorText(await attachProjectIdToEditorPayload({ content, title: 'Автосохранение', path: '', kind: 'autosave', metaEnabled: false }));

    setDirtyState(true); // восстановленный черновик считается несохранённым
    const autosaveHash = computeHash(content);
    lastAutosaveHash = autosaveHash;
    backupHashes.set(autosavePath, autosaveHash);
    updateStatus('Восстановлено из автосохранения');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ui:recovery-restored', {
        message: 'Recovered autosave on reopen path',
        source: 'autosave',
      });
    }
    return true;
  } catch (error) {
    logDevError('restoreAutosaveIfExists', error);
    return false;
  }
}

// Сохранение и восстановление размеров окна
const DEFAULT_WINDOW_SIZE = {
  width: 3456,
  height: 2234
};

const windowState = {
  width: DEFAULT_WINDOW_SIZE.width,
  height: DEFAULT_WINDOW_SIZE.height,
  x: undefined,
  y: undefined
};

async function loadWindowStateFromSettings() {
  try {
    const settings = await loadSettings();
    if (Number.isFinite(settings.windowWidth) && settings.windowWidth > 0) {
      windowState.width = settings.windowWidth;
    }
    if (Number.isFinite(settings.windowHeight) && settings.windowHeight > 0) {
      windowState.height = settings.windowHeight;
    }
    if (Number.isFinite(settings.windowX)) {
      windowState.x = settings.windowX;
    }
    if (Number.isFinite(settings.windowY)) {
      windowState.y = settings.windowY;
    }
  } catch {
    // Игнорируем ошибки
  }
}

async function persistWindowState(bounds) {
  try {
    const settings = await loadSettings();
    settings.windowWidth = bounds.width;
    settings.windowHeight = bounds.height;
    settings.windowX = bounds.x;
    settings.windowY = bounds.y;
    await saveSettings(settings);
  } catch {
    // Тихо игнорируем
  }
}

function getAutosaveDir() {
  const documentsPath = fileManager.getDocumentsPath();
  return path.join(documentsPath, '.autosave');
}

function getAutosavePath() {
  return path.join(getAutosaveDir(), 'autosave.txt');
}

async function ensureAutosaveDirectory() {
  const dir = getAutosaveDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Папка может уже существовать
  }
  return dir;
}

async function deleteAutosaveFile() {
  const autosavePath = getAutosavePath();
  try {
    await fs.unlink(autosavePath);
  } catch {
    // Игнорируем, если файла нет
  }
}

async function writeAutosaveFile(content) {
  const autosavePath = getAutosavePath();
  await ensureAutosaveDirectory();
  return fileManager.writeFileAtomic(autosavePath, content);
}

function updateStatus(status) {
  if (mainWindow) {
    mainWindow.webContents.send('status-update', status);
  }
}

function setDirtyState(state) {
  isDirty = state;
  if (mainWindow) {
    mainWindow.webContents.send('set-dirty', state);
  }
}

function sendRuntimeCommand(command, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  mainWindow.webContents.send('ui:runtime-command', {
    command,
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
  });
  return true;
}

function sendCanonicalRuntimeCommand(commandId, payload = {}, legacyCommand = '') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const envelope = {
    commandId,
    payload: safePayload,
  };
  if (typeof legacyCommand === 'string' && legacyCommand.length > 0) {
    envelope.command = legacyCommand;
  }
  mainWindow.webContents.send('ui:runtime-command', envelope);
  return true;
}

function resolveCollabScopeLocalState() {
  const rawValue = typeof process.env.COLLAB_SCOPE_LOCAL === 'string'
    ? process.env.COLLAB_SCOPE_LOCAL.trim().toLowerCase()
    : '';
  if (rawValue === '1' || rawValue === 'true' || rawValue === 'yes' || rawValue === 'on') {
    return true;
  }
  const aliasValue = typeof process.env.COLLAB_SCOPE_FLAG_ACTIVE === 'string'
    ? process.env.COLLAB_SCOPE_FLAG_ACTIVE.trim().toLowerCase()
    : '';
  return aliasValue === '1' || aliasValue === 'true' || aliasValue === 'yes' || aliasValue === 'on';
}

ipcMain.on('editor:text-response', (_, payload) => {
  const requestId = payload && payload.requestId;
  if (!requestId) {
    return;
  }

  const pending = pendingTextRequests.get(requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingTextRequests.delete(requestId);
  pending.resolve(typeof payload?.text === 'string' ? payload.text : '');
});

ipcMain.on('editor:snapshot-response', (_, payload) => {
  const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
  if (!requestId) {
    return;
  }

  const pending = pendingSnapshotRequests.get(requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingSnapshotRequests.delete(requestId);
  pending.resolve(normalizeEditorSnapshotPayload(payload ? payload.snapshot : null));
});

ipcMain.on(EDITOR_PASTE_FOCUS_STATE_CHANNEL, (_, payload) => {
  const focused = normalizeEditorPasteFocusState(payload);
  if (focused === null) return;
  isEditorPasteTargetFocused = focused;
});

async function executeFileCommand(intentRaw) {
  const intent = typeof intentRaw === 'string' ? intentRaw : '';
  const commandId = {
    open: COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_OPEN,
    save: COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_SAVE,
    saveAs: COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_SAVE_AS,
  }[intent] || '';
  try {
    if (intent === 'new') {
      await ensureCleanAction(handleNew);
      return { ok: true, intent };
    }
    if (!commandId) {
      return { ok: false, reason: 'FILE_COMMAND_INTENT_UNSUPPORTED', intent };
    }
    const result = await dispatchCommandSurfaceKernel(commandId, {});
    if (result && (result.ok === true || result.ok === 1)) {
      return { ok: true, intent, commandId };
    }
    return {
      ok: false,
      reason: result && result.error && typeof result.error.reason === 'string'
        ? result.error.reason
        : 'COMMAND_EXECUTION_FAILED',
      intent,
      commandId,
      error: result && result.error && typeof result.error === 'object' ? result.error : undefined,
    };
  } catch (error) {
    logDevError(`file-command:${intent || 'unknown'}`, error);
    return {
      ok: false,
      reason: 'FILE_COMMAND_UNHANDLED_EXCEPTION',
      intent,
      error: {
        message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
      },
    };
  }
}

ipcMain.handle('file:save', async () => {
  return executeFileCommand('save');
});

ipcMain.handle('file:save-as', async () => {
  return executeFileCommand('saveAs');
});

ipcMain.handle('file:open', async (_, payload) => {
  const intent = payload && typeof payload === 'object' && payload.intent === 'new' ? 'new' : 'open';
  return executeFileCommand(intent);
});

ipcMain.handle(EXPORT_DOCX_MIN_CHANNEL, async (_, payload) => {
  return handleExportDocxMin(payload);
});

ipcMain.handle(IMPORT_MARKDOWN_V1_CHANNEL, async (_, payload) => {
  return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, payload);
});

ipcMain.handle(EXPORT_MARKDOWN_V1_CHANNEL, async (_, payload) => {
  return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, payload);
});

ipcMain.handle(FLOW_OPEN_V1_CHANNEL, async () => {
  return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_FLOW_OPEN_V1, {});
});

ipcMain.handle(FLOW_SAVE_V1_CHANNEL, async (_, payload) => {
  return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_FLOW_SAVE_V1, payload);
});

ipcMain.handle('ui:request-autosave', async () => {
  return autoSave();
});

ipcMain.handle('ui:get-collab-scope-local', async () => {
  return handleWorkspaceCollabScopeLocalQuery();
});

ipcMain.handle('ui:command-bridge', async (_, request) => {
  const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
    ? request
    : {};
  const route = typeof safeRequest.route === 'string' ? safeRequest.route : '';
  const commandId = typeof safeRequest.commandId === 'string' ? safeRequest.commandId : '';
  const payload = safeRequest.payload && typeof safeRequest.payload === 'object' && !Array.isArray(safeRequest.payload)
    ? safeRequest.payload
    : {};

  if (route !== COMMAND_BUS_ROUTE) {
    return { ok: false, reason: 'COMMAND_ROUTE_UNSUPPORTED' };
  }
  if (!UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS.has(commandId)) {
    return { ok: false, reason: 'COMMAND_ID_NOT_ALLOWED' };
  }

  try {
    const result = await dispatchMenuCommand(commandId, payload, { route: COMMAND_BUS_ROUTE });
    if (result && result.ok === true) {
      return { ok: true, value: result };
    }
    return {
      ok: false,
      reason: 'COMMAND_EXECUTION_FAILED',
      value: result && typeof result === 'object' ? result : null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'COMMAND_EXECUTION_THROW',
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
});

ipcMain.handle('ui:workspace-query-bridge', async (_, request) => {
  const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
    ? request
    : {};
  const queryId = typeof safeRequest.queryId === 'string' ? safeRequest.queryId : '';
  const payload = safeRequest.payload && typeof safeRequest.payload === 'object' && !Array.isArray(safeRequest.payload)
    ? safeRequest.payload
    : {};

  if (!WORKSPACE_QUERY_BRIDGE_ALLOWED_QUERY_IDS.has(queryId)) {
    return { ok: false, error: 'QUERY_ID_NOT_ALLOWED' };
  }

  if (queryId === 'query.projectTree') {
    return handleWorkspaceProjectTreeQuery(payload);
  }
  if (queryId === 'query.collabScopeLocal') {
    return handleWorkspaceCollabScopeLocalQuery();
  }
  if (queryId === 'query.reviewSurface') {
    return handleWorkspaceReviewSurfaceQuery();
  }
  return { ok: false, error: 'QUERY_ID_NOT_ALLOWED' };
});

ipcMain.handle('ui:save-lifecycle-signal-bridge', async (_, request) => {
  const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
    ? request
    : {};
  const signalId = typeof safeRequest.signalId === 'string' ? safeRequest.signalId : '';
  const payload = safeRequest.payload && typeof safeRequest.payload === 'object' && !Array.isArray(safeRequest.payload)
    ? safeRequest.payload
    : {};

  if (!SAVE_LIFECYCLE_SIGNAL_BRIDGE_ALLOWED_SIGNAL_IDS.has(signalId)) {
    return { ok: false, error: 'SIGNAL_ID_NOT_ALLOWED' };
  }

  if (signalId === 'signal.localDirty.set') {
    if (typeof payload.state !== 'boolean') {
      return { ok: false, error: 'SIGNAL_PAYLOAD_INVALID' };
    }
    isDirty = payload.state;
    return { ok: true };
  }
  if (signalId === 'signal.autoSave.request') {
    return autoSave();
  }
  return { ok: false, error: 'SIGNAL_ID_NOT_ALLOWED' };
});

ipcMain.on('dirty-changed', (_, state) => {
  isDirty = state;
});

ipcMain.on('ui:set-theme', (_, theme) => {
  if (typeof theme === 'string') {
    handleThemeChange(theme);
  }
});

ipcMain.on('ui:set-font', (_, fontFamily) => {
  if (typeof fontFamily === 'string') {
    handleFontChange(fontFamily);
  }
});

ipcMain.on('ui:set-font-size', async (_, px) => {
  const nextSize = Number(px);
  if (!Number.isFinite(nextSize)) return;
  currentFontSize = clampFontSize(nextSize);
  sendEditorFontSize(currentFontSize);
  try {
    const settings = await loadSettings();
    settings.fontSize = currentFontSize;
    await saveSettings(settings);
  } catch (error) {
    logDevError('ui:set-font-size', error);
  }
});

ipcMain.on('ui:font-size', (_, action) => {
  handleFontSizeChange(action).catch(() => {});
});

ipcMain.on('ui:window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

async function handleWorkspaceProjectTreeQuery(payload) {
  const tab = payload && payload.tab;
  if (!tab) {
    return { ok: false, error: 'Missing tab' };
  }

  await ensureProjectStructure();

  if (tab === 'roman') {
    const romanRoot = await buildRomanTree();
    const mindmapRoot = await buildMindMapTree();
    const printRoot = await buildPrintTree();
    const root = buildNode({
      name: 'Roman tab',
      label: 'Roman',
      kind: 'roman-tab-root',
      nodePath: getProjectRootPath(),
      children: [romanRoot, mindmapRoot, printRoot]
    });
    return { ok: true, root };
  }
  if (tab === 'materials') {
    const root = await buildMaterialsTree();
    return { ok: true, root };
  }
  if (tab === 'reference') {
    const root = await buildReferenceTree();
    return { ok: true, root };
  }

  return { ok: false, error: 'Unknown tab' };
}

function handleWorkspaceCollabScopeLocalQuery() {
  return resolveCollabScopeLocalState();
}

const REVIEW_SURFACE_DIRECT_KEYS = Object.freeze([
  'reviewSurface',
  'revisionSession',
  'session',
  'exactTextPlanPreview',
  'planPreview',
  'structuralManualReviewPreview',
  'commentSurvivalPreview',
  'revisionBridgePreviewResult',
  'previewInput',
  'reviewPacket',
  'shadowPreview',
  'blockedApplyPlan',
  'receipt',
]);

function looksLikeDirectReviewSurfacePayload(value) {
  if (!isPlainObjectValue(value)) return false;
  return REVIEW_SURFACE_DIRECT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasReviewSurfacePayload(value) {
  return isPlainObjectValue(value) && Object.keys(value).length > 0;
}

function parseReviewSurfaceJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    return isPlainObjectValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readCurrentReviewSurfaceSourceText() {
  try {
    const snapshot = await requestEditorSnapshot(1200);
    if (snapshot && typeof snapshot.content === 'string' && snapshot.content.trim()) {
      return snapshot.content;
    }
  } catch (error) {
    logDevError('query.reviewSurface:snapshot', error);
  }

  if (typeof currentFilePath === 'string' && currentFilePath.trim() && isAllowedFilePath(currentFilePath)) {
    try {
      const content = await fs.readFile(currentFilePath, 'utf8');
      if (typeof content === 'string' && content.trim()) return content;
    } catch (error) {
      logDevError('query.reviewSurface:fileRead', error);
    }
  }

  return '';
}

async function buildDerivedReviewSurfacePayload() {
  const sourceText = await readCurrentReviewSurfaceSourceText();
  const parsed = parseReviewSurfaceJson(sourceText);
  if (!parsed) return {};

  if (isPlainObjectValue(parsed.reviewSurface)) {
    return cloneJsonSafe(parsed.reviewSurface) || {};
  }

  if (looksLikeDirectReviewSurfacePayload(parsed)) {
    return cloneJsonSafe(parsed) || {};
  }

  if (parsed.type === 'revisionBridge.stage01FixedCorePreview' && isPlainObjectValue(parsed.preview)) {
    return cloneJsonSafe(parsed.preview) || {};
  }

  if (parsed.type === 'revisionBridge.exactTextApplyPlanNoDiskPreview') {
    return { exactTextPlanPreview: cloneJsonSafe(parsed) };
  }

  if (parsed.type === 'revisionBridge.structuralManualReviewPreview') {
    return { structuralManualReviewPreview: cloneJsonSafe(parsed) };
  }

  if (parsed.type === 'revisionBridge.commentSurvival.preview') {
    return { commentSurvivalPreview: cloneJsonSafe(parsed) };
  }

  if (parsed.type === 'revisionBridge.exactTextMinSafeWrite') {
    return {
      receipt: isPlainObjectValue(parsed.receipt) ? cloneJsonSafe(parsed.receipt) : null,
    };
  }

  if (parsed.type === 'revisionBridge.parsedReviewSurfaceAdapter') {
    return cloneJsonSafe(parsed) || {};
  }

  if (isPlainObjectValue(parsed.parsedSurface) || isPlainObjectValue(parsed.reviewPacket)) {
    try {
      const revisionBridge = await loadRevisionBridgeModule();
      if (isPlainObjectValue(parsed.parsedSurface)) {
        const adapted = revisionBridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
          projectId: typeof parsed.projectId === 'string' ? parsed.projectId : '',
          sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : '',
          baselineHash: typeof parsed.baselineHash === 'string' ? parsed.baselineHash : '',
          parsedSurface: cloneJsonSafe(parsed.parsedSurface),
        });
        return cloneJsonSafe(adapted) || {};
      }
      if (isPlainObjectValue(parsed.reviewPacket)) {
        const preview = revisionBridge.buildRevisionPacketPreview({
          projectId: typeof parsed.projectId === 'string' ? parsed.projectId : '',
          sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : '',
          baselineHash: typeof parsed.baselineHash === 'string' ? parsed.baselineHash : '',
          reviewPacket: cloneJsonSafe(parsed.reviewPacket),
        });
        return {
          reviewPacket: cloneJsonSafe(parsed.reviewPacket),
          revisionBridgePreviewResult: cloneJsonSafe(preview),
        };
      }
    } catch (error) {
      logDevError('query.reviewSurface:derive', error);
    }
  }

  return {};
}

async function directReviewSurfacePayloadStillMatchesCurrentText() {
  if (currentReviewSurfacePayloadSource !== 'direct') return false;
  if (typeof currentReviewSurfacePayloadContentHash !== 'string' || !currentReviewSurfacePayloadContentHash) {
    return false;
  }
  const sourceText = await readCurrentReviewSurfaceSourceText();
  if (typeof sourceText !== 'string' || !sourceText.trim()) return false;
  return computeHash(sourceText) === currentReviewSurfacePayloadContentHash;
}

async function handleWorkspaceReviewSurfaceQuery() {
  return {
    ok: true,
    reviewSurface: readActiveReviewSessionReviewSurface(),
  };
}

ipcMain.handle('ui:get-project-tree', async (_, payload) => {
  return handleWorkspaceProjectTreeQuery(payload);
});

async function handleUiOpenDocumentCommand(payload) {
  if (!mainWindow) {
    return { ok: false, error: 'No active window' };
  }

  const guarded = sanitizePayloadWithinProjectRoot(payload, ['path']);
  if (!guarded.ok || !guarded.payload) {
    return guarded.error;
  }

  const safePayload = guarded.payload;
  const filePath = safePayload.path;
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return { ok: false, error: 'Invalid file path' };
  }

  const canProceed = await confirmDiscardChanges();
  if (!canProceed) {
    return { ok: false, cancelled: true };
  }

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  } catch (error) {
    logDevError('open document mkdir', error);
    return { ok: false, error: error.message || 'Failed to create folder' };
  }

  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      logDevError('open document read', error);
      return { ok: false, error: error.message || 'Failed to read file' };
    }

    const created = await queueDiskOperation(
      () => fileManager.writeFileAtomic(filePath, ''),
      'create document file'
    );
    if (!created.success) {
      return { ok: false, error: created.error || 'Failed to create file' };
    }
  }

  const context = safePayload && safePayload.kind ? {
    title: typeof safePayload.title === 'string' ? safePayload.title : getDisplayNameForEntry(path.basename(filePath)),
    kind: safePayload.kind,
    metaEnabled: ROMAN_META_KINDS.has(safePayload.kind)
  } : getDocumentContextFromPath(filePath);

  currentFilePath = filePath;
  await saveLastFile();
  sendEditorText(await attachProjectIdToEditorPayload({
    content,
    title: context.title,
    path: filePath,
    kind: context.kind,
    metaEnabled: context.metaEnabled
  }));
  setDirtyState(false);
  const contentHash = computeHash(content);
  lastAutosaveHash = contentHash;
  backupHashes.set(filePath, contentHash);
  updateStatus('Готово');
  return { ok: true, path: filePath };
}

const LEGACY_UI_TREE_DOCUMENT_COMMAND_IDS = new Set([
  'cmd.project.document.open',
  'cmd.project.tree.createNode',
  'cmd.project.tree.renameNode',
  'cmd.project.tree.deleteNode',
  'cmd.project.tree.reorderNode',
]);

function normalizeLegacyUiBridgePayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function dispatchLegacyUiTreeDocumentCommand(commandId, payload = {}) {
  if (!LEGACY_UI_TREE_DOCUMENT_COMMAND_IDS.has(commandId)) {
    return { ok: false, error: 'LEGACY_UI_COMMAND_NOT_ALLOWED' };
  }
  try {
    const result = await dispatchMenuCommand(
      commandId,
      normalizeLegacyUiBridgePayload(payload),
      { route: COMMAND_BUS_ROUTE },
    );
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return result;
    }
    return { ok: false, error: 'COMMAND_EXECUTION_FAILED' };
  } catch (error) {
    logDevError(`legacy-ui-tree-document-command:${commandId}`, error);
    return {
      ok: false,
      error: error && typeof error.message === 'string' ? error.message : 'COMMAND_EXECUTION_THROW',
    };
  }
}

ipcMain.handle('ui:open-document', async (_, payload) => {
  return dispatchLegacyUiTreeDocumentCommand('cmd.project.document.open', payload);
});

async function handleUiCreateNodeCommand(payload) {
  const guarded = sanitizePayloadWithinProjectRoot(payload, ['parentPath']);
  if (!guarded.ok || !guarded.payload) {
    return guarded.error;
  }
  const safePayload = guarded.payload;
  if (typeof safePayload.parentPath !== 'string' || typeof safePayload.kind !== 'string') {
    return { ok: false, error: 'Invalid payload' };
  }

  const parentPath = safePayload.parentPath;
  const kind = safePayload.kind;
  const name = typeof safePayload.name === 'string' ? safePayload.name : '';
  const safeName = sanitizeFilename(name);

  const createWithPrefix = async (baseName, isFile) => {
    const entries = await readDirectoryEntries(parentPath);
    const nextIndex = entries.length + 1;
    const prefixed = formatPrefixedName(baseName, nextIndex);
    const finalName = isFile ? `${prefixed}.txt` : prefixed;
    const targetPath = joinPathSegmentsWithinRoot(parentPath, [finalName], { resolveSymlinks: false });
    if (await fileExists(targetPath)) {
      return { ok: false, error: 'Файл уже существует' };
    }
    if (isFile) {
      const result = await fileManager.writeFileAtomic(targetPath, '');
      if (!result.success) {
        return { ok: false, error: result.error || 'Failed to create file' };
      }
      return { ok: true, path: targetPath };
    }
    await fs.mkdir(targetPath, { recursive: true });
    return { ok: true, path: targetPath };
  };

  const createWithoutPrefix = async (baseName, isFile) => {
    const finalName = isFile ? `${baseName}.txt` : baseName;
    const targetPath = joinPathSegmentsWithinRoot(parentPath, [finalName], { resolveSymlinks: false });
    if (await fileExists(targetPath)) {
      return { ok: false, error: 'Файл уже существует' };
    }
    if (isFile) {
      const result = await fileManager.writeFileAtomic(targetPath, '');
      if (!result.success) {
        return { ok: false, error: result.error || 'Failed to create file' };
      }
      return { ok: true, path: targetPath };
    }
    await fs.mkdir(targetPath, { recursive: true });
    return { ok: true, path: targetPath };
  };

  if (kind === 'part') {
    return createWithPrefix(safeName || 'Новая часть', false);
  }
  if (kind === 'chapter-file') {
    return createWithPrefix(safeName || 'Новая глава', true);
  }
  if (kind === 'chapter-folder') {
    return createWithPrefix(safeName || 'Новая глава', false);
  }
  if (kind === 'scene') {
    return createWithPrefix(safeName || 'Новая сцена', true);
  }
  if (kind === 'folder') {
    return createWithoutPrefix(safeName || 'Новая папка', false);
  }
  if (kind === 'file') {
    return createWithoutPrefix(safeName || 'Новый документ', true);
  }

  return { ok: false, error: 'Unknown node kind' };
}

ipcMain.handle('ui:create-node', async (_, payload) => {
  return dispatchLegacyUiTreeDocumentCommand('cmd.project.tree.createNode', payload);
});

async function handleUiRenameNodeCommand(payload) {
  const guarded = sanitizePayloadWithinProjectRoot(payload, ['path']);
  if (!guarded.ok || !guarded.payload) {
    return guarded.error;
  }
  const safePayload = guarded.payload;
  if (typeof safePayload.path !== 'string' || typeof safePayload.name !== 'string') {
    return { ok: false, error: 'Invalid payload' };
  }

  const nodePath = safePayload.path;
  const newName = sanitizeFilename(safePayload.name);
  if (!newName) {
    return { ok: false, error: 'Empty name' };
  }

  const baseName = path.basename(nodePath);
  const isFile = baseName.toLowerCase().endsWith('.txt');
  const prefix = extractNumericPrefix(baseName);
  const finalBase = prefix !== null ? `${String(prefix).padStart(2, '0')}_${newName}` : newName;
  const finalName = isFile ? `${finalBase}.txt` : finalBase;
  const targetPath = joinPathSegmentsWithinRoot(path.dirname(nodePath), [finalName], { resolveSymlinks: false });

  if (targetPath === nodePath) {
    return { ok: true, path: nodePath };
  }

  try {
    await fs.rename(nodePath, targetPath);
  } catch (error) {
    logDevError('rename node', error);
    return { ok: false, error: error.message || 'Failed to rename' };
  }

  if (currentFilePath && isPathInside(nodePath, currentFilePath)) {
    const relative = path.relative(nodePath, currentFilePath);
    currentFilePath = joinPathSegmentsWithinRoot(targetPath, [relative], { resolveSymlinks: false });
    await saveLastFile();
  }

  return { ok: true, path: targetPath };
}

ipcMain.handle('ui:rename-node', async (_, payload) => {
  return dispatchLegacyUiTreeDocumentCommand('cmd.project.tree.renameNode', payload);
});

async function handleUiDeleteNodeCommand(payload) {
  const guarded = sanitizePayloadWithinProjectRoot(payload, ['path']);
  if (!guarded.ok || !guarded.payload) {
    return guarded.error;
  }
  const safePayload = guarded.payload;
  if (typeof safePayload.path !== 'string') {
    return { ok: false, error: 'Invalid payload' };
  }

  const nodePath = safePayload.path;

  const trashPath = getProjectSectionPath('trash');
  await fs.mkdir(trashPath, { recursive: true });
  const baseName = path.basename(nodePath);
  let targetPath = joinPathSegmentsWithinRoot(trashPath, [baseName], { resolveSymlinks: false });
  if (await fileExists(targetPath)) {
    const stamped = `${Date.now()}_${baseName}`;
    targetPath = joinPathSegmentsWithinRoot(trashPath, [stamped], { resolveSymlinks: false });
  }

  try {
    await fs.rename(nodePath, targetPath);
  } catch (error) {
    logDevError('delete node', error);
    return { ok: false, error: error.message || 'Failed to move to trash' };
  }

  if (currentFilePath && isPathInside(nodePath, currentFilePath)) {
    currentFilePath = null;
    await saveLastFile();
    sendEditorText(await attachProjectIdToEditorPayload({ content: '', title: '', path: '', kind: 'empty', metaEnabled: false }));
    setDirtyState(false);
    updateStatus('Готово');
  }

  return { ok: true, path: targetPath };
}

ipcMain.handle('ui:delete-node', async (_, payload) => {
  return dispatchLegacyUiTreeDocumentCommand('cmd.project.tree.deleteNode', payload);
});

async function handleUiReorderNodeCommand(payload) {
  const guarded = sanitizePayloadWithinProjectRoot(payload, ['path']);
  if (!guarded.ok || !guarded.payload) {
    return guarded.error;
  }
  const safePayload = guarded.payload;
  if (typeof safePayload.path !== 'string' || typeof safePayload.direction !== 'string') {
    return { ok: false, error: 'Invalid payload' };
  }

  const nodePath = safePayload.path;
  const direction = safePayload.direction;
  const romanRoot = getProjectSectionPath('roman');

  if (!isPathInside(romanRoot, nodePath)) {
    return { ok: false, error: 'Reorder only supported in roman' };
  }

  const parentPath = path.dirname(nodePath);
  const entries = await readDirectoryEntries(parentPath);
  const index = entries.findIndex((entry) => entry.path === nodePath);
  if (index === -1) {
    return { ok: false, error: 'Node not found' };
  }

  const targetIndex = direction === 'up' ? index - 1 : direction === 'down' ? index + 1 : index;
  if (targetIndex < 0 || targetIndex >= entries.length || targetIndex === index) {
    return { ok: true, path: nodePath };
  }

  const nextEntries = entries.slice();
  const [moved] = nextEntries.splice(index, 1);
  nextEntries.splice(targetIndex, 0, moved);

  const reordered = await reorderEntriesWithPrefixes(parentPath, nextEntries);
  const updated = reordered.find((entry) => entry.path === nodePath || entry.nextPath === nodePath);
  const updatedPath = updated?.nextPath || nodePath;

  if (currentFilePath && isPathInside(nodePath, currentFilePath)) {
    const relative = path.relative(nodePath, currentFilePath);
    currentFilePath = joinPathSegmentsWithinRoot(updatedPath, [relative], { resolveSymlinks: false });
    await saveLastFile();
  }

  return { ok: true, path: updatedPath };
}

ipcMain.handle('ui:reorder-node', async (_, payload) => {
  return dispatchLegacyUiTreeDocumentCommand('cmd.project.tree.reorderNode', payload);
});
ipcMain.handle('ui:open-section', async (_, payload) => {
  if (!mainWindow) {
    return { ok: false, error: 'No active window' };
  }

  const sectionName = payload && payload.sectionName;
  if (typeof sectionName !== 'string' || !sectionName.trim()) {
    return { ok: false, error: 'Invalid section name' };
  }

  const canProceed = await confirmDiscardChanges();
  if (!canProceed) {
    return { ok: false, cancelled: true };
  }

  const filePath = getSectionDocumentPath(sectionName);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  } catch (error) {
    logDevError('open section mkdir', error);
    return { ok: false, error: error.message || 'Failed to create folder' };
  }

  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      logDevError('open section read', error);
      return { ok: false, error: error.message || 'Failed to read file' };
    }

    const created = await queueDiskOperation(
      () => fileManager.writeFileAtomic(filePath, ''),
      'create section file'
    );
    if (!created.success) {
      return { ok: false, error: created.error || 'Failed to create file' };
    }
  }

  currentFilePath = filePath;
  await saveLastFile();
  sendEditorText(await attachProjectIdToEditorPayload({ content, title: sectionName, path: filePath, kind: 'legacy-section', metaEnabled: false }));
  setDirtyState(false);
  const contentHash = computeHash(content);
  lastAutosaveHash = contentHash;
  backupHashes.set(filePath, contentHash);
  updateStatus('Готово');
  return { ok: true, filePath };
});

function createWindow() {
  // Восстановление размеров и позиции окна
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const desiredWidth = Number.isFinite(windowState.width) ? windowState.width : DEFAULT_WINDOW_SIZE.width;
  const desiredHeight = Number.isFinite(windowState.height) ? windowState.height : DEFAULT_WINDOW_SIZE.height;
  const width = Math.min(desiredWidth, screenWidth);
  const height = Math.min(desiredHeight, screenHeight);

  mainWindow = new BrowserWindow({
    width,
    height,
    x: windowState.x,
    y: windowState.y,
    backgroundColor: '#dbd4ca',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', blockExternalNavigation);
  mainWindow.webContents.on('will-redirect', blockExternalNavigation);

  logPerfStage('create-window');

  const useLegacyEditor = process.env.USE_LEGACY_EDITOR === '1';
  const useTiptap = !useLegacyEditor;
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: { USE_TIPTAP: (useTiptap ? '1' : '0') },
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && mainWindow && mainWindow.isFullScreen()) {
      event.preventDefault();
      mainWindow.setFullScreen(false);
      return;
    }

    handlePrimaryPasteShortcut(event, input, mainWindow);
  });
  mainWindow.on('blur', () => {
    isEditorPasteTargetFocused = false;
  });

  // Открыть последний файл и применить настройки после загрузки
  mainWindow.webContents.once('did-finish-load', async () => {
    mainWindow.webContents.setZoomFactor(1);
    logPerfStage('did-finish-load');
    await loadSavedFontSize();
    const restored = await restoreAutosaveIfExists();
    if (!restored) {
      const openResult = await openLastFile();
      if (openResult !== 'loaded' && openResult !== 'error') {
        updateStatus('Готово');
      }
    }
  });

  // Сохранение размеров и позиции окна + запрос при несохранённых изменениях
  mainWindow.on('close', (event) => {
    if (isWindowClosing || isQuitting) {
      return;
    }

    event.preventDefault();

    (async () => {
      const canClose = await confirmDiscardChanges();
      if (!canClose) {
        return;
      }

      if (mainWindow) {
        const bounds = mainWindow.getBounds();
        await persistWindowState(bounds);
      }

      isWindowClosing = true;
      mainWindow.close();
    })().catch(() => {});
  });

  mainWindow.on('closed', () => {
    clearPendingTextRequests('Window closed');
    mainWindow = null;
    isWindowClosing = false;
  });

  mainWindow.on('resize', () => {
    if (mainWindow) {
      persistWindowState(mainWindow.getBounds()).catch(() => {});
    }
  });

  mainWindow.on('move', () => {
    if (mainWindow) {
      persistWindowState(mainWindow.getBounds()).catch(() => {});
    }
  });

  // Открыть DevTools только в режиме разработки (опционально)
  // mainWindow.webContents.openDevTools();
}

async function handleNew() {
  if (!mainWindow) return;
  currentFilePath = null;
  await saveLastFile();
  sendEditorText(await attachProjectIdToEditorPayload({ content: '', title: '', path: '', kind: 'empty', metaEnabled: false }));
  setDirtyState(false);
  lastAutosaveHash = null;
  updateStatus('Готово');
}

async function handleOpen() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Открыть файл',
    defaultPath: fileManager.getDocumentsPath(),
    filters: [
      { name: 'Текстовые файлы', extensions: ['txt'] },
      { name: 'Все файлы', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    if (!isAllowedFilePath(filePath)) {
      updateStatus('Ошибка');
      return makeAllowlistReject('FILE_OPEN_PATH_NOT_ALLOWED', filePath);
    }
    const fileResult = await fileManager.readFile(filePath);
    
    if (fileResult.success) {
      currentFilePath = filePath;
      await saveLastFile();
      const context = getDocumentContextFromPath(filePath);
      sendEditorText(await attachProjectIdToEditorPayload({
        content: fileResult.content,
        title: context.title,
        path: filePath,
        kind: context.kind,
        metaEnabled: context.metaEnabled
      }));
      setDirtyState(false);
      const contentHash = computeHash(fileResult.content);
      lastAutosaveHash = contentHash;
      backupHashes.set(filePath, contentHash);
      updateStatus('Готово');
    } else {
      updateStatus('Ошибка');
    }
  }
}

async function autoSave() {
  if (!mainWindow || autoSaveInProgress) {
    return true;
  }

  if (!isDirty) {
    return true;
  }

  autoSaveInProgress = true;
  try {
    const snapshot = await requestEditorSnapshot();
    const content = snapshot.content;
    const currentHash = computeHash(content);

    if (currentFilePath) {
      if (currentHash !== lastAutosaveHash) {
        const saveResult = await queueDiskOperation(
          () => fileManager.writeFileAtomic(currentFilePath, content),
          'autosave file'
        );
        if (!saveResult.success) {
          updateStatus('Ошибка сохранения');
          return false;
        }
      }
      await persistBookProfileForFile(currentFilePath, snapshot.bookProfile, 'autosave project manifest');

      lastAutosaveHash = currentHash;
      setDirtyState(false);
      updateStatus('Автосохранено');
      await saveLastFile();
      return true;
    }

    if (currentHash === lastAutosaveHash) {
      setDirtyState(false);
      return true;
    }

    const autosaveResult = await queueDiskOperation(
      () => writeAutosaveFile(content),
      'autosave temporary'
    );
    if (!autosaveResult.success) {
      updateStatus('Ошибка сохранения');
      return false;
    }

    lastAutosaveHash = currentHash;
    setDirtyState(false);
    updateStatus('Автосохранено');
    return true;
  } catch (error) {
    updateStatus('Ошибка сохранения');
    logDevError('autoSave', error);
    return false;
  } finally {
    autoSaveInProgress = false;
  }
}

// Создание бэкапа раз в минуту
async function createBackup() {
  if (!mainWindow) {
    return;
  }

  try {
    if (currentFilePath) {
      const snapshot = await requestEditorSnapshot();
      const content = snapshot.content;
      const hash = computeHash(content);
      if (backupHashes.get(currentFilePath) === hash) {
        return;
      }

      const result = await queueDiskOperation(
        () => backupManager.createBackup(currentFilePath, content, { basePath: getBackupBasePathForFile(currentFilePath) }),
        'backup current file'
      );
      if (!result.success) {
        updateStatus('Ошибка');
        return;
      }

      backupHashes.set(currentFilePath, hash);
      return;
    }

    const autosavePath = getAutosavePath();
    const autosaveExists = await fileExists(autosavePath);
    if (!autosaveExists) {
      return;
    }

    const autosaveResult = await fileManager.readFile(autosavePath);
    if (!autosaveResult.success) {
      updateStatus('Ошибка');
      return;
    }

    const autosaveHash = computeHash(autosaveResult.content);
    if (backupHashes.get(autosavePath) === autosaveHash) {
      return;
    }

    const backupResult = await queueDiskOperation(
      () => backupManager.createBackup(autosavePath, autosaveResult.content),
      'backup autosave'
    );
    if (!backupResult.success) {
      updateStatus('Ошибка');
      return;
    }

    backupHashes.set(autosavePath, autosaveHash);
  } catch (error) {
    updateStatus('Ошибка');
    logDevError('createBackup', error);
  }
}

async function handleSave() {
  if (!mainWindow) {
    return false;
  }

  let snapshot;
  try {
    snapshot = await requestEditorSnapshot();
  } catch (error) {
    updateStatus('Ошибка');
    logDevError('handleSave', error);
    return false;
  }
  const content = snapshot.content;
  const wasUntitled = currentFilePath === null;

  if (currentFilePath) {
    if (!isAllowedFilePath(currentFilePath)) {
      updateStatus('Ошибка');
      return false;
    }
    const saveResult = await queueDiskOperation(
      () => fileManager.writeFileAtomic(currentFilePath, content),
      'save existing file'
    );
    if (saveResult.success) {
      await persistBookProfileForFile(currentFilePath, snapshot.bookProfile, 'save project manifest');
      lastAutosaveHash = computeHash(content);
      setDirtyState(false);
      updateStatus('Сохранено');
      await saveLastFile();
      return true;
    }
    updateStatus('Ошибка');
    return false;
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить файл',
    defaultPath: fileManager.getDocumentsPath(),
    filters: [
      { name: 'Текстовые файлы', extensions: ['txt'] },
      { name: 'Все файлы', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    let filePath = result.filePath;
    if (!filePath.endsWith('.txt')) {
      filePath += '.txt';
    }
    if (!isAllowedFilePath(filePath)) {
      updateStatus('Ошибка');
      return false;
    }

    const saveResult = await queueDiskOperation(
      () => fileManager.writeFileAtomic(filePath, content),
      'save new file'
    );
    if (saveResult.success) {
      await persistBookProfileForFile(filePath, snapshot.bookProfile, 'save project manifest');
      lastAutosaveHash = computeHash(content);
      currentFilePath = filePath;
      await saveLastFile();
      setDirtyState(false);
      updateStatus('Сохранено');
      if (wasUntitled) {
        await deleteAutosaveFile();
        backupHashes.delete(getAutosavePath());
      }
      return true;
    }
    updateStatus('Ошибка');
  }

  return false;
}

async function handleSaveAs() {
  if (!mainWindow) {
    return false;
  }

  let snapshot;
  try {
    snapshot = await requestEditorSnapshot();
  } catch (error) {
    updateStatus('Ошибка');
    logDevError('handleSaveAs', error);
    return false;
  }
  const content = snapshot.content;

  const wasUntitled = currentFilePath === null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить файл',
    defaultPath: currentFilePath || fileManager.getDocumentsPath(),
    filters: [
      { name: 'Текстовые файлы', extensions: ['txt'] },
      { name: 'Все файлы', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    let filePath = result.filePath;
    if (!filePath.endsWith('.txt')) {
      filePath += '.txt';
    }
    if (!isAllowedFilePath(filePath)) {
      updateStatus('Ошибка');
      return false;
    }

    const saveResult = await queueDiskOperation(
      () => fileManager.writeFileAtomic(filePath, content),
      'save as file'
    );
    if (saveResult.success) {
      await persistBookProfileForFile(filePath, snapshot.bookProfile, 'save project manifest');
      lastAutosaveHash = computeHash(content);
      currentFilePath = filePath;
      await saveLastFile();
      setDirtyState(false);
      updateStatus('Сохранено');
      if (wasUntitled) {
        await deleteAutosaveFile();
        backupHashes.delete(getAutosavePath());
      }
      return true;
    }
    updateStatus('Ошибка');
  }

  return false;
}

async function confirmDiscardChanges() {
  if (!isDirty || !mainWindow) {
    return true;
  }

  return autoSave();
}

async function ensureCleanAction(actionFn) {
  const canProceed = await confirmDiscardChanges();
  if (!canProceed) {
    return;
  }

  await actionFn();
}

function handleFontChange(fontFamily) {
  if (mainWindow) {
    mainWindow.webContents.send('font-changed', fontFamily);
  }
}

function handleThemeChange(theme) {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', theme);
  }
}

// Обработка изменения размера шрифта
async function handleFontSizeChange(action) {
  if (!mainWindow) return;
  
  try {
    let newSize = currentFontSize;
    const minSize = 12;
    const maxSize = 28;
    
    if (action === 'increase') {
      newSize = Math.min(currentFontSize + 1, maxSize);
    } else if (action === 'decrease') {
      newSize = Math.max(currentFontSize - 1, minSize);
    } else if (action === 'reset') {
      newSize = 16;
    }
    
    if (newSize !== currentFontSize) {
      currentFontSize = clampFontSize(newSize);
      sendEditorFontSize(currentFontSize);

      const settings = await loadSettings();
      settings.fontSize = currentFontSize;
      await saveSettings(settings);
    }
  } catch (error) {
    logDevError('handleFontSizeChange', error);
  }
}

const {
  resolveMenuCommandId,
} = require('./menu/command-namespace-canon.js');
const {
  DEFAULT_ARTIFACT_PATH: DEFAULT_MENU_ARTIFACT_PATH,
  evaluateMenuArtifactLockState,
  resolveModeFromInput: resolveMenuArtifactModeFromInput,
  RESULT_FAIL: MENU_ARTIFACT_RESULT_FAIL,
} = require('./menu/menu-artifact-lock.js');
const {
  normalizeMenuConfigPipeline,
} = require('./menu/menu-config-normalizer.js');
const {
  validateMenuContext,
  toMenuRuntimeNormalizerContext,
} = require('./menu/menu-runtime-context.js');
const {
  FAIL_SIGNAL_MENU_RUNTIME_ARTIFACT_DIVERGENCE,
  evaluateRuntimeMenuSourcePolicy,
} = require('./menu/menu-runtime-source-policy.js');
const MENU_ACCELERATOR_TOKENS = Object.freeze({
  platformQuit: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q'
});
const COMMAND_BUS_ROUTE = 'command.bus';
const ALLOWED_MENU_ROLES = new Set(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']);
const MENU_ROLE_TEMPLATES = Object.freeze({
  undo: { role: 'undo' },
  redo: { role: 'redo' },
  cut: { role: 'cut' },
  copy: { role: 'copy' },
  paste: { role: 'paste' },
  selectAll: { role: 'selectAll' }
});
const MENU_RUNTIME_OVERLAYS_ENV_PATH = 'MENU_RUNTIME_OVERLAYS_PATH';
const MENU_RUNTIME_OVERLAYS_ENV_JSON = 'MENU_RUNTIME_OVERLAYS_JSON';
const MENU_RUNTIME_CONTEXT_ENV_PATH = 'MENU_RUNTIME_CONTEXT_PATH';
const MENU_RUNTIME_CONTEXT_ENV_JSON = 'MENU_RUNTIME_CONTEXT_JSON';
const MENU_RUNTIME_ARTIFACT_ENV_PATH = 'MENU_RUNTIME_ARTIFACT_PATH';
const MENU_RUNTIME_RAW_CONFIG_ENV_PATH = 'MENU_RUNTIME_RAW_CONFIG_PATH';
const MENU_RUNTIME_LEGACY_RAW_CONFIG_ENV_PATH = 'MENU_CONFIG_PATH';
const UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS = new Set([
  'cmd.project.new',
  'cmd.project.open',
  'cmd.project.save',
  'cmd.project.saveAs',
  'cmd.project.export.docxMin',
  'cmd.project.docx.previewContent',
  'cmd.project.docx.previewImportPlan',
  'cmd.project.docx.importSafeCreate',
  'cmd.project.docx.previewLocalFile',
  'cmd.project.importMarkdownV1',
  'cmd.project.exportMarkdownV1',
  'cmd.project.releaseClaim.admit',
  'cmd.project.review.importLocalPacket',
  'cmd.project.review.importPacket',
  'cmd.project.review.clearSession',
  'cmd.project.review.applyExactTextChange',
  'cmd.project.review.applyExactTextChangesBatch',
  'cmd.project.review.inspectDocxIntakeGate',
  'cmd.project.review.inspectDocxReviewPreflight',
  'cmd.project.review.activateDocxReviewPreviewSession',
  'cmd.project.review.openDocxReviewPreviewSession',
  'cmd.project.flowOpenV1',
  'cmd.project.flowSaveV1',
  'cmd.project.document.open',
  'cmd.project.tree.createNode',
  'cmd.project.tree.renameNode',
  'cmd.project.tree.deleteNode',
  'cmd.project.tree.reorderNode',
  'cmd.ui.theme.set',
  'cmd.ui.font.set',
  'cmd.ui.fontSize.set',
]);
const WORKSPACE_QUERY_BRIDGE_ALLOWED_QUERY_IDS = new Set([
  'query.projectTree',
  'query.collabScopeLocal',
  'query.reviewSurface',
]);
const SAVE_LIFECYCLE_SIGNAL_BRIDGE_ALLOWED_SIGNAL_IDS = new Set([
  'signal.localDirty.set',
  'signal.autoSave.request',
]);
const MENU_ACTION_ALIAS_TO_COMMAND = Object.freeze({
  newDocument: 'cmd.project.new',
  openDocument: 'cmd.project.open',
  saveDocument: 'cmd.project.save',
  exportDocxMin: 'cmd.project.export.docxMin',
  quitApp: 'cmd.app.quit',
  setFont: 'cmd.ui.font.set',
  setFontSize: 'cmd.ui.fontSize.set',
  setTheme: 'cmd.ui.theme.set',
  resetMenuCustomization: MENU_CUSTOMIZATION_COMMAND_RESET,
  toggleMenuSectionVisibility: MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY,
  moveMenuSectionEarlier: MENU_CUSTOMIZATION_COMMAND_MOVE_EARLIER,
  moveMenuSectionLater: MENU_CUSTOMIZATION_COMMAND_MOVE_LATER,
});
const MENU_COMMAND_HANDLERS = Object.freeze({
  'cmd.project.new': async () => {
    await ensureCleanAction(handleNew);
    return { ok: true };
  },
  'cmd.project.open': async () => {
    return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_OPEN, {});
  },
  'cmd.project.save': async () => {
    return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_SAVE, {});
  },
  'cmd.project.saveAs': async () => {
    return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_SAVE_AS, {});
  },
  'cmd.project.edit.undo': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.edit.undo',
      { source: 'menu' },
      'edit-undo',
    );
    return { ok: delivered };
  },
  'cmd.project.edit.redo': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.edit.redo',
      { source: 'menu' },
      'edit-redo',
    );
    return { ok: delivered };
  },
  'cmd.project.edit.find': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.edit.find',
      { source: 'menu' },
      'search',
    );
    return { ok: delivered };
  },
  'cmd.project.edit.replace': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.edit.replace',
      { source: 'menu' },
      'replace',
    );
    return { ok: delivered };
  },
  'cmd.project.export.docxMin': async (payload = {}) => {
    const previewRequested = sendCanonicalRuntimeCommand(
      'cmd.project.export.docxMin',
      {
        source: 'menu',
        preview: true,
      },
      'open-export-preview',
    );
    if (previewRequested) {
      return { ok: true, preview: true };
    }
    const response = await handleExportDocxMin({
      requestId: 'menu-export-docx-min',
      outPath: typeof payload.outPath === 'string' ? payload.outPath : '',
      outDir: typeof payload.outDir === 'string' ? payload.outDir : '',
      bufferSource: typeof payload.bufferSource === 'string' ? payload.bufferSource : '',
      options: payload.options && typeof payload.options === 'object' && !Array.isArray(payload.options)
        ? payload.options
        : {},
    });
    return { ok: Boolean(response && response.ok === 1) };
  },
  'cmd.project.docx.previewContent': async (payload = {}) => {
    return handleDocxContentPreviewCommandSurface(payload);
  },
  'cmd.project.docx.previewImportPlan': async (payload = {}) => {
    return handleDocxImportPreviewCommandSurface(payload);
  },
  'cmd.project.docx.importSafeCreate': async (payload = {}) => {
    return handleDocxImportSafeCreateCommandSurface(payload);
  },
  'cmd.project.docx.previewLocalFile': async (payload = {}) => {
    return handleDocxImportLocalFilePreviewCommandSurface(payload);
  },
  'cmd.project.importMarkdownV1': async (payload = {}) => {
    return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, payload);
  },
  'cmd.project.exportMarkdownV1': async (payload = {}) => {
    return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, payload);
  },
  'cmd.project.releaseClaim.admit': async (payload = {}) => {
    return dispatchCommandSurfaceKernel(COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_RELEASE_CLAIM_ADMIT, payload);
  },
  'cmd.project.review.importLocalPacket': async (payload = {}) => {
    const result = await handleReviewSurfaceImportLocalPacketCommandSurface(payload);
    if (result && result.ok === true && result.imported === true) {
      sendCanonicalRuntimeCommand(
        'cmd.project.review.openComments',
        { source: 'review-import-local-packet', requestId: result.requestId },
        'review-comment',
      );
    }
    return result;
  },
  'cmd.project.review.importPacket': async (payload = {}) => {
    return handleReviewSurfaceImportPacketCommandSurface(payload);
  },
  'cmd.project.review.clearSession': async () => {
    const result = handleReviewSurfaceClearSessionCommandSurface();
    if (result && result.ok === true) {
      sendCanonicalRuntimeCommand(
        'cmd.project.review.openComments',
        { source: 'review-clear-session' },
        'review-comment',
      );
    }
    return result;
  },
  'cmd.project.review.applyExactTextChange': async (payload = {}) => {
    return handleReviewSurfaceApplyExactTextChangeCommandSurface(payload);
  },
  'cmd.project.review.applyExactTextChangesBatch': async (payload = {}) => {
    return handleReviewSurfaceApplyExactTextChangesBatchCommandSurface(payload);
  },
  'cmd.project.review.inspectDocxIntakeGate': async (payload = {}) => {
    return handleDocxIntakeGateCommandSurface(payload);
  },
  'cmd.project.review.inspectDocxReviewPreflight': async (payload = {}) => {
    return handleDocxReviewPreflightCommandSurface(payload);
  },
  'cmd.project.review.activateDocxReviewPreviewSession': async (payload = {}) => {
    const result = await handleDocxReviewPreviewSessionActivationCommandSurface(payload);
    if (result && result.ok === true && result.activated === true) {
      sendCanonicalRuntimeCommand(
        'cmd.project.review.openComments',
        { source: 'review-docx-preview-session', requestId: result.requestId },
        'review-comment',
      );
    }
    return result;
  },
  'cmd.project.review.openDocxReviewPreviewSession': async (payload = {}) => {
    const result = await handleDocxReviewPreviewSessionLocalFileCommandSurface(payload);
    if (result && result.ok === true && result.activated === true) {
      sendCanonicalRuntimeCommand(
        'cmd.project.review.openComments',
        { source: 'review-docx-local-file-preview-session', requestId: result.requestId },
        'review-comment',
      );
    }
    return result;
  },
  'cmd.project.flowOpenV1': async () => {
    return handleFlowOpenV1();
  },
  'cmd.project.flowSaveV1': async (payload = {}) => {
    return handleFlowSaveV1(payload);
  },
  'cmd.app.quit': () => {
    app.quit();
    return { ok: true };
  },
  'cmd.project.view.openSettings': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.view.openSettings',
      { source: 'menu' },
      'open-settings',
    );
    return { ok: delivered };
  },
  'cmd.project.view.safeReset': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.view.safeReset',
      { source: 'menu' },
      'safe-reset-shell',
    );
    return { ok: delivered };
  },
  'cmd.project.view.restoreLastStable': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.view.restoreLastStable',
      { source: 'menu' },
      'restore-last-stable-shell',
    );
    return { ok: delivered };
  },
  'cmd.project.tools.openDiagnostics': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.tools.openDiagnostics',
      { source: 'menu' },
      'open-diagnostics',
    );
    return { ok: delivered };
  },
  'cmd.project.review.openRecovery': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.review.openRecovery',
      { source: 'menu' },
      'open-recovery',
    );
    return { ok: delivered };
  },
  'cmd.project.insert.addCard': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.insert.addCard',
      { source: 'menu' },
      'insert-add-card',
    );
    return { ok: delivered };
  },
  'cmd.project.format.alignLeft': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.format.alignLeft',
      { source: 'menu' },
      'format-align-left',
    );
    return { ok: delivered };
  },
  'cmd.project.plan.switchMode': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.plan.switchMode',
      { source: 'menu' },
      'switch-mode-plan',
    );
    return { ok: delivered };
  },
  'cmd.project.review.switchMode': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.review.switchMode',
      { source: 'menu' },
      'switch-mode-review',
    );
    return { ok: delivered };
  },
  'cmd.project.window.switchModeWrite': () => {
    const delivered = sendCanonicalRuntimeCommand(
      'cmd.project.window.switchModeWrite',
      { source: 'menu' },
      'switch-mode-write',
    );
    return { ok: delivered };
  },
  [MENU_PRESENTATION_COMMAND_CLASSIC]: async () => {
    return setMenuPresentationMode(MENU_PRESENTATION_MODE_CLASSIC);
  },
  [MENU_PRESENTATION_COMMAND_COMPACT]: async () => {
    return setMenuPresentationMode(MENU_PRESENTATION_MODE_COMPACT);
  },
  [MENU_LOCALE_COMMAND_BASE]: async () => {
    return setMenuLocale(MENU_LOCALE_MODE_BASE);
  },
  [MENU_LOCALE_COMMAND_RU]: async () => {
    return setMenuLocale(MENU_LOCALE_MODE_RU);
  },
  [MENU_LOCALE_COMMAND_EN]: async () => {
    return setMenuLocale(MENU_LOCALE_MODE_EN);
  },
  [MENU_CUSTOMIZATION_COMMAND_RESET]: async () => {
    return resetMenuCustomization();
  },
  [MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY]: async (payload = {}) => {
    const sectionId = typeof payload.sectionId === 'string'
      ? payload.sectionId
      : (typeof payload.actionArg === 'string' ? payload.actionArg : '');
    return toggleMenuSectionVisibility(sectionId);
  },
  [MENU_CUSTOMIZATION_COMMAND_MOVE_EARLIER]: async (payload = {}) => {
    const sectionId = typeof payload.sectionId === 'string'
      ? payload.sectionId
      : (typeof payload.actionArg === 'string' ? payload.actionArg : '');
    return moveMenuSectionEarlier(sectionId);
  },
  [MENU_CUSTOMIZATION_COMMAND_MOVE_LATER]: async (payload = {}) => {
    const sectionId = typeof payload.sectionId === 'string'
      ? payload.sectionId
      : (typeof payload.actionArg === 'string' ? payload.actionArg : '');
    return moveMenuSectionLater(sectionId);
  },
  'cmd.project.document.open': async (payload = {}) => {
    return handleUiOpenDocumentCommand(payload);
  },
  'cmd.project.tree.createNode': async (payload = {}) => {
    return handleUiCreateNodeCommand(payload);
  },
  'cmd.project.tree.renameNode': async (payload = {}) => {
    return handleUiRenameNodeCommand(payload);
  },
  'cmd.project.tree.deleteNode': async (payload = {}) => {
    return handleUiDeleteNodeCommand(payload);
  },
  'cmd.project.tree.reorderNode': async (payload = {}) => {
    return handleUiReorderNodeCommand(payload);
  },
  'cmd.ui.font.set': (payload = {}) => {
    const fontFamily = typeof payload.fontFamily === 'string'
      ? payload.fontFamily
      : (typeof payload.actionArg === 'string' ? payload.actionArg : '');
    if (!fontFamily) return { ok: false };
    handleFontChange(fontFamily);
    return { ok: true };
  },
  'cmd.ui.fontSize.set': async (payload = {}) => {
    const px = Number(payload.px);
    if (Number.isFinite(px)) {
      currentFontSize = clampFontSize(px);
      sendEditorFontSize(currentFontSize);
      try {
        const settings = await loadSettings();
        settings.fontSize = currentFontSize;
        await saveSettings(settings);
      } catch (error) {
        logDevError('cmd.ui.fontSize.set', error);
      }
      return { ok: true };
    }
    const action = typeof payload.action === 'string'
      ? payload.action
      : (typeof payload.actionArg === 'string' ? payload.actionArg : '');
    if (!action) return { ok: false };
    await handleFontSizeChange(action);
    return { ok: true };
  },
  'cmd.ui.theme.set': (payload = {}) => {
    const theme = typeof payload.theme === 'string'
      ? payload.theme
      : (typeof payload.actionArg === 'string' ? payload.actionArg : '');
    if (!theme) return { ok: false };
    handleThemeChange(theme);
    return { ok: true };
  },
});

function shouldFailHardOnMenuConfigError() {
  return process.env.MENU_CONFIG_CONTRACT_MODE === '1' || process.argv.includes('--menu-config-contract');
}

function resolveRuntimeMenuArtifactMode() {
  const promotionArg = process.argv.find((arg) => String(arg || '').startsWith('--promotionMode='));
  if (promotionArg) {
    const value = String(promotionArg.split('=').slice(1).join('=') || '').trim().toLowerCase();
    if (value === '1' || value === 'true' || value === 'yes' || value === 'on') {
      return 'promotion';
    }
  }
  return resolveMenuArtifactModeFromInput('');
}

function verifyMenuArtifactLockAtRuntime() {
  const mode = resolveRuntimeMenuArtifactMode();
  const state = evaluateMenuArtifactLockState({
    mode,
    expectedSnapshotId: 'menu-default-desktop-minimal',
  });

  if (state.result === MENU_ARTIFACT_RESULT_FAIL) {
    const error = new Error(`Menu artifact verification failed (${state.failSignalCode || 'E_MENU_ARTIFACT_TAMPER_OR_DRIFT'})`);
    error.failSignalCode = state.failSignalCode || 'E_MENU_ARTIFACT_TAMPER_OR_DRIFT';
    error.details = state;
    throw error;
  }

  if (state.mismatch === true) {
    const issues = Array.isArray(state.issues) ? state.issues.map((row) => row.code).join(',') : '';
    console.warn(`[menu-artifact] advisory mismatch in ${mode}: ${issues}`);
  }
}

function normalizeRuntimeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRuntimeRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createRuntimeMenuPolicyError(message, details = {}, mode = 'release') {
  const error = new Error(message);
  error.code = 'MENU_RUNTIME_POLICY_VIOLATION';
  error.failSignalCode = FAIL_SIGNAL_MENU_RUNTIME_ARTIFACT_DIVERGENCE;
  error.details = details;
  error.menuRuntimeBlocking = mode === 'promotion';
  return error;
}

function emitRuntimeMenuAdvisory(message, details = {}) {
  let detailsText = '';
  try {
    detailsText = Object.keys(details).length > 0 ? ` ${JSON.stringify(details)}` : '';
  } catch {
    detailsText = '';
  }
  console.warn(
    `[menu-runtime] advisory ${FAIL_SIGNAL_MENU_RUNTIME_ARTIFACT_DIVERGENCE}: ${message}${detailsText}`,
  );
}

function parseRuntimeJsonInput(pathEnvKey, jsonEnvKey, label) {
  const inlineJson = normalizeRuntimeString(process.env[jsonEnvKey]);
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson);
    } catch (error) {
      throw new Error(`Invalid ${label} JSON in ${jsonEnvKey}: ${error.message}`);
    }
  }

  const payloadPathRaw = normalizeRuntimeString(process.env[pathEnvKey]);
  if (!payloadPathRaw) return null;
  const payloadPath = resolveValidatedPath(payloadPathRaw, { mode: 'any' });
  let rawText = '';
  try {
    rawText = fsSync.readFileSync(payloadPath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${label} payload from ${payloadPath}: ${error.message}`);
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON in ${payloadPath}: ${error.message}`);
  }
}

function resolveRuntimeMenuLocaleCatalog(artifactDoc) {
  if (isRuntimeRecord(artifactDoc) && isRuntimeRecord(artifactDoc.localeCatalog)) {
    return artifactDoc.localeCatalog;
  }
  return {
    version: 'v1',
    locales: [MENU_LOCALE_MODE_BASE, MENU_LOCALE_MODE_RU, MENU_LOCALE_MODE_EN],
    entries: {},
  };
}

function normalizeRuntimeOverlayPayload(payload) {
  if (payload === null || payload === undefined) return [];
  if (Array.isArray(payload)) return payload;
  if (isRuntimeRecord(payload) && Array.isArray(payload.overlays)) {
    return payload.overlays;
  }
  throw new Error('Runtime overlays payload must be an array or an object with overlays[].');
}

function normalizeRuntimeContextPayload(payload) {
  if (payload === null || payload === undefined) return {};
  if (isRuntimeRecord(payload) && isRuntimeRecord(payload.context)) {
    return payload.context;
  }
  if (isRuntimeRecord(payload)) return payload;
  throw new Error('Runtime context payload must be an object.');
}

function resolveRuntimeMenuArtifactPath() {
  const explicitPath = normalizeRuntimeString(process.env[MENU_RUNTIME_ARTIFACT_ENV_PATH]);
  if (!explicitPath) return DEFAULT_MENU_ARTIFACT_PATH;
  return path.resolve(explicitPath);
}

function resolveRawConfigMixAttempt() {
  const explicit = normalizeRuntimeString(process.env[MENU_RUNTIME_RAW_CONFIG_ENV_PATH]);
  if (explicit) return explicit;
  return normalizeRuntimeString(process.env[MENU_RUNTIME_LEGACY_RAW_CONFIG_ENV_PATH]);
}

function readMenuArtifactDocument(artifactPath) {
  let parsed;
  try {
    parsed = JSON.parse(fsSync.readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read runtime menu artifact (${artifactPath}): ${error.message}`);
  }

  if (!isRuntimeRecord(parsed)) {
    throw new Error(`Runtime menu artifact must be an object: ${artifactPath}`);
  }
  if (!Array.isArray(parsed.menus)) {
    throw new Error(`Runtime menu artifact must contain menus[]: ${artifactPath}`);
  }
  return parsed;
}

function resolveRuntimeMenuBuildConfig(mode) {
  const artifactPath = resolveRuntimeMenuArtifactPath();
  const artifactDoc = readMenuArtifactDocument(artifactPath);
  const sourcePolicy = evaluateRuntimeMenuSourcePolicy({
    mode,
    usesArtifact: true,
    usesRawConfig: Boolean(resolveRawConfigMixAttempt()),
  });

  if (!sourcePolicy.ok) {
    throw createRuntimeMenuPolicyError(
      'Runtime menu source policy failed.',
      {
        reason: sourcePolicy.reason,
        result: sourcePolicy.result,
      },
      mode,
    );
  }

  if (sourcePolicy.result === 'WARN') {
    emitRuntimeMenuAdvisory('Runtime menu source mix rejected; fallback to artifact-only.', {
      reason: sourcePolicy.reason,
    });
  }

  const artifactOnlyConfig = {
    fonts: Array.isArray(artifactDoc.fonts) ? artifactDoc.fonts : [],
    localeCatalog: resolveRuntimeMenuLocaleCatalog(artifactDoc),
    menus: artifactDoc.menus,
  };
  if (sourcePolicy.fallbackToArtifactOnly) {
    return artifactOnlyConfig;
  }

  let overlayPayload;
  let contextPayload;
  try {
    overlayPayload = parseRuntimeJsonInput(
      MENU_RUNTIME_OVERLAYS_ENV_PATH,
      MENU_RUNTIME_OVERLAYS_ENV_JSON,
      'runtime overlays',
    );
    contextPayload = parseRuntimeJsonInput(
      MENU_RUNTIME_CONTEXT_ENV_PATH,
      MENU_RUNTIME_CONTEXT_ENV_JSON,
      'runtime context',
    );
  } catch (error) {
    if (mode === 'promotion') {
      throw createRuntimeMenuPolicyError(error.message, { reason: 'RUNTIME_MENU_INPUT_PARSE_FAILED' }, mode);
    }
    emitRuntimeMenuAdvisory(error.message, { reason: 'RUNTIME_MENU_INPUT_PARSE_FAILED' });
    return artifactOnlyConfig;
  }

  let overlays;
  let contextInput = {};
  try {
    overlays = normalizeRuntimeOverlayPayload(overlayPayload);
    contextInput = normalizeRuntimeContextPayload(contextPayload);
  } catch (error) {
    if (mode === 'promotion') {
      throw createRuntimeMenuPolicyError(error.message, { reason: 'RUNTIME_MENU_INPUT_INVALID' }, mode);
    }
    emitRuntimeMenuAdvisory(error.message, { reason: 'RUNTIME_MENU_INPUT_INVALID' });
    return artifactOnlyConfig;
  }
  if (overlays.length === 0) {
    return artifactOnlyConfig;
  }

  const contextState = validateMenuContext(contextInput, { mode });
  if (!contextState.ok) {
    const details = {
      reason: 'RUNTIME_MENU_CONTEXT_INVALID',
      contextErrors: contextState.errors,
    };
    if (mode === 'promotion') {
      throw createRuntimeMenuPolicyError('Runtime menu context validation failed.', details, mode);
    }
    emitRuntimeMenuAdvisory('Runtime menu context validation failed; fallback to artifact-only.', details);
    return artifactOnlyConfig;
  }

  const normalizerState = normalizeMenuConfigPipeline({
    baseConfig: {
      version: 'v2',
      menus: artifactDoc.menus,
      fonts: Array.isArray(artifactDoc.fonts) ? artifactDoc.fonts : [],
    },
    overlays,
    context: toMenuRuntimeNormalizerContext(contextState.normalizedCtx),
    mode,
    baseSourceRef: artifactPath,
  });

  if (!normalizerState.ok || !normalizerState.normalizedConfig) {
    const details = {
      reason: 'RUNTIME_MENU_NORMALIZATION_FAILED',
      diagnostics: normalizerState.diagnostics,
    };
    if (mode === 'promotion') {
      throw createRuntimeMenuPolicyError('Runtime overlay normalization failed.', details, mode);
    }
    emitRuntimeMenuAdvisory('Runtime overlay normalization failed; fallback to artifact-only.', details);
    return artifactOnlyConfig;
  }

  return {
    fonts: Array.isArray(artifactDoc.fonts) ? artifactDoc.fonts : [],
    localeCatalog: isRuntimeRecord(normalizerState.normalizedConfig.localeCatalog)
      ? normalizerState.normalizedConfig.localeCatalog
      : resolveRuntimeMenuLocaleCatalog(artifactDoc),
    menus: normalizerState.normalizedConfig.menus,
  };
}

function resolveMenuAccelerator(value) {
  if (typeof value !== 'string' || !value.startsWith('$')) {
    return value;
  }

  const token = value.slice(1);
  if (!Object.prototype.hasOwnProperty.call(MENU_ACCELERATOR_TOKENS, token)) {
    throw new Error(`Unsupported menu accelerator token: ${value}`);
  }
  return MENU_ACCELERATOR_TOKENS[token];
}

function resolveMenuActionToCommand(actionId) {
  if (typeof actionId !== 'string' || actionId.length === 0) {
    throw new Error(`Invalid menu action id: ${String(actionId)}`);
  }
  const commandId = MENU_ACTION_ALIAS_TO_COMMAND[actionId];
  if (typeof commandId !== 'string' || commandId.length === 0) {
    throw new Error(`Unknown menu action id: ${String(actionId)}`);
  }
  if (isMenuLocalCustomizationCommandId(commandId)) {
    return commandId;
  }
  const resolved = resolveMenuCommandId(commandId, { enforceSunset: false });
  if (!resolved.ok) {
    throw new Error(`Menu action namespace resolution failed: ${resolved.reason || 'COMMAND_NAMESPACE_RESOLUTION_FAILED'}`);
  }
  return resolved.commandId;
}

function dispatchMenuCommand(commandId, payload = {}, options = {}) {
  const route = typeof options.route === 'string' && options.route.length > 0
    ? options.route
    : COMMAND_BUS_ROUTE;
  if (route !== COMMAND_BUS_ROUTE) {
    throw new Error(`Unsupported menu command route: ${route}`);
  }

  if (isMenuLocalCustomizationCommandId(commandId)) {
    const handler = MENU_COMMAND_HANDLERS[commandId];
    if (typeof handler !== 'function') {
      throw new Error(`Unknown menu command id: ${String(commandId)}`);
    }
    return handler(payload);
  }

  const resolved = resolveMenuCommandId(commandId, { enforceSunset: false });
  if (!resolved.ok) {
    throw new Error(`Unknown menu command namespace: ${String(commandId)}`);
  }

  const handler = MENU_COMMAND_HANDLERS[resolved.commandId];
  if (typeof handler !== 'function') {
    throw new Error(`Unknown menu command id: ${String(resolved.commandId)}`);
  }

  return handler(payload);
}

function buildCommandClickHandler(commandId, payload = {}) {
  return () => {
    try {
      const result = dispatchMenuCommand(commandId, payload, { route: COMMAND_BUS_ROUTE });
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          logDevError(`menu-command:${commandId}`, error);
        });
      }
    } catch (error) {
      logDevError(`menu-command:${commandId}`, error);
    }
  };
}

function buildFontSubmenu(config) {
  return config.fonts.map((font, index) => {
    if (!font || typeof font !== 'object') {
      throw new Error(`Invalid font config at fonts[${index}]`);
    }
    if (typeof font.label !== 'string' || typeof font.value !== 'string') {
      throw new Error(`Invalid font config at fonts[${index}]: label/value are required`);
    }

    return {
      id: typeof font.id === 'string' ? font.id : `font-${index}`,
      label: font.label,
      click: buildCommandClickHandler('cmd.ui.font.set', { fontFamily: font.value })
    };
  });
}

function cloneMenuTemplateItem(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const cloned = { ...item };
  if (Array.isArray(item.items)) {
    cloned.items = item.items.map((child) => cloneMenuTemplateItem(child));
  }
  if (Array.isArray(item.submenu)) {
    cloned.submenu = item.submenu.map((child) => cloneMenuTemplateItem(child));
  }
  return cloned;
}

function buildMenuCustomizationVisibilitySectionsSubmenu(config) {
  const sections = resolveOrderedCustomizableMenuSections(config);
  const hiddenSet = new Set(normalizeCustomizationStateForCurrentSections(currentMenuCustomization).hiddenMenuIds);

  return sections.map((section) => ({
    id: `view-menu-customization-visibility-${section.id}`,
    label: section.label,
    type: 'checkbox',
    checked: !hiddenSet.has(section.id),
    click: buildCommandClickHandler(MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY, {
      actionArg: section.id,
    }),
  }));
}

function buildMenuCustomizationOrderSectionsSubmenu(config) {
  const sections = resolveOrderedCustomizableMenuSections(config);
  const localeCatalog = resolveRuntimeMenuLocaleCatalog(config);
  const moveEarlierLabel = resolveLocalizedMenuLabel(
    localeCatalog,
    MENU_CUSTOMIZATION_MOVE_EARLIER_LABEL_KEY,
    'Move Earlier',
  );
  const moveLaterLabel = resolveLocalizedMenuLabel(
    localeCatalog,
    MENU_CUSTOMIZATION_MOVE_LATER_LABEL_KEY,
    'Move Later',
  );

  return sections.flatMap((section, index) => ([
    {
      id: `view-menu-customization-order-${section.id}-earlier`,
      label: `${moveEarlierLabel}: ${section.label}`,
      enabled: index > 0,
      click: buildCommandClickHandler(MENU_CUSTOMIZATION_COMMAND_MOVE_EARLIER, {
        actionArg: section.id,
      }),
    },
    {
      id: `view-menu-customization-order-${section.id}-later`,
      label: `${moveLaterLabel}: ${section.label}`,
      enabled: index < sections.length - 1,
      click: buildCommandClickHandler(MENU_CUSTOMIZATION_COMMAND_MOVE_LATER, {
        actionArg: section.id,
      }),
    },
  ]));
}

function applyMenuCustomization(template, config) {
  const clonedTemplate = Array.isArray(template)
    ? template.map((item) => cloneMenuTemplateItem(item))
    : [];
  const sections = resolveCustomizableMenuSections(config);
  const canonicalIds = sections.map((section) => section.id);
  currentMenuCustomizationSectionIds = canonicalIds;
  currentMenuCustomization = normalizeMenuCustomizationState(currentMenuCustomization, canonicalIds);

  if (clonedTemplate.length === 0 || canonicalIds.length === 0) {
    return clonedTemplate;
  }

  const topLevelById = new Map();
  clonedTemplate.forEach((item) => {
    if (item && typeof item.id === 'string' && item.id.length > 0) {
      topLevelById.set(item.id, item);
    }
  });

  const orderedOptionalIds = currentMenuCustomization.menuOrder.filter((id) => canonicalIds.includes(id));
  const hiddenSet = new Set(currentMenuCustomization.hiddenMenuIds);
  const projected = [];

  MENU_CUSTOMIZATION_FIXED_PREFIX_IDS.forEach((id) => {
    const fixedItem = topLevelById.get(id);
    if (fixedItem) {
      projected.push(fixedItem);
    }
  });

  orderedOptionalIds.forEach((id) => {
    if (hiddenSet.has(id)) {
      return;
    }
    const optionalItem = topLevelById.get(id);
    if (optionalItem) {
      projected.push(optionalItem);
    }
  });

  const helpItem = topLevelById.get(MENU_CUSTOMIZATION_FIXED_TAIL_ID);
  if (helpItem) {
    projected.push(helpItem);
  }

  return projected;
}

function mergeCompactDuplicateMenuItem(existingItem, nextItem) {
  const existingSubmenu = Array.isArray(existingItem?.submenu) ? existingItem.submenu : [];
  const nextSubmenu = Array.isArray(nextItem?.submenu) ? nextItem.submenu : [];

  if (existingSubmenu.length === 0 && nextSubmenu.length > 0) {
    return nextItem;
  }
  if (nextSubmenu.length === 0 && existingSubmenu.length > 0) {
    return existingItem;
  }
  if (nextSubmenu.length > existingSubmenu.length) {
    return nextItem;
  }
  return existingItem;
}

function dedupeCompactRootSubmenu(items) {
  const deduped = [];
  const idToIndex = new Map();

  items.forEach((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || item.id.length === 0) {
      deduped.push(item);
      return;
    }

    if (!idToIndex.has(item.id)) {
      idToIndex.set(item.id, deduped.length);
      deduped.push(item);
      return;
    }

    const index = idToIndex.get(item.id);
    deduped[index] = mergeCompactDuplicateMenuItem(deduped[index], item);
  });

  return deduped;
}

function extractCompactRootPinnedItems(nestedGroups) {
  const pinnedItems = [];
  const projectedGroups = nestedGroups.map((item) => {
    if (!item || item.id !== 'view' || !Array.isArray(item.submenu)) {
      return item;
    }

    const projectedSubmenu = [];
    item.submenu.forEach((child) => {
      if (child && child.id === 'view-presentation-mode') {
        pinnedItems.push(cloneMenuTemplateItem(child));
        return;
      }
      projectedSubmenu.push(child);
    });

    return {
      ...item,
      submenu: projectedSubmenu,
    };
  });

  return {
    pinnedItems,
    projectedGroups,
  };
}

function buildCompactMenuTemplate(template) {
  const fileMenu = template.find((item) => item && item.id === 'file');
  if (!fileMenu || !Array.isArray(fileMenu.submenu)) {
    return template.map((item) => cloneMenuTemplateItem(item));
  }

  const compactRootSubmenu = [];
  const nestedGroups = template
    .filter((item) => item && item.id !== 'file')
    .map((item) => cloneMenuTemplateItem(item));
  const { pinnedItems, projectedGroups } = extractCompactRootPinnedItems(nestedGroups);

  compactRootSubmenu.push(...pinnedItems);
  if (pinnedItems.length > 0 && fileMenu.submenu.length > 0) {
    compactRootSubmenu.push({ type: 'separator' });
  }

  compactRootSubmenu.push(...fileMenu.submenu.map((item) => cloneMenuTemplateItem(item)));

  if (compactRootSubmenu.length > 0 && projectedGroups.length > 0) {
    compactRootSubmenu.push({ type: 'separator' });
  }
  compactRootSubmenu.push(...projectedGroups);

  const compactRoot = {
    id: MENU_PRESENTATION_COMPACT_ROOT_ID,
    label: fileMenu.label,
    submenu: dedupeCompactRootSubmenu(compactRootSubmenu),
  };

  if (process.platform === 'darwin') {
    return [
      { role: 'appMenu' },
      compactRoot,
    ];
  }

  return [compactRoot];
}

function applyMenuPresentation(template) {
  if (currentMenuPresentationMode !== MENU_PRESENTATION_MODE_COMPACT) {
    return template;
  }
  return buildCompactMenuTemplate(template);
}

function resolveLocalizedMenuLabel(localeCatalog, labelKey, fallbackLabel) {
  const entries = isRuntimeRecord(localeCatalog) && isRuntimeRecord(localeCatalog.entries)
    ? localeCatalog.entries
    : {};
  const entry = isRuntimeRecord(entries) ? entries[labelKey] : null;
  if (!entry || typeof entry !== 'object') {
    return fallbackLabel;
  }

  const localeValue = typeof entry[currentMenuLocale] === 'string' && entry[currentMenuLocale].trim().length > 0
    ? entry[currentMenuLocale].trim()
    : '';
  if (localeValue) return localeValue;

  const baseValue = typeof entry.base === 'string' && entry.base.trim().length > 0
    ? entry.base.trim()
    : '';
  return baseValue || fallbackLabel;
}

function localizeMenuConfigNode(node, localeCatalog) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return node;
  }

  const localized = { ...node };
  if (typeof node.label === 'string' && typeof node.labelKey === 'string') {
    localized.label = resolveLocalizedMenuLabel(localeCatalog, node.labelKey, node.label);
  }
  if (Array.isArray(node.items)) {
    localized.items = node.items.map((entry) => localizeMenuConfigNode(entry, localeCatalog));
  }
  return localized;
}

function applyMenuLocale(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config;
  }

  const localeCatalog = resolveRuntimeMenuLocaleCatalog(config);
  return {
    ...config,
    localeCatalog,
    fonts: Array.isArray(config.fonts) ? config.fonts.map((font) => ({ ...font })) : [],
    menus: Array.isArray(config.menus)
      ? config.menus.map((entry) => localizeMenuConfigNode(entry, localeCatalog))
      : [],
  };
}

function resolveAboutLicensesMenuLabel() {
  try {
    const artifactDoc = readMenuArtifactDocument(resolveRuntimeMenuArtifactPath());
    return resolveLocalizedMenuLabel(
      resolveRuntimeMenuLocaleCatalog(artifactDoc),
      MENU_LOCALE_ABOUT_LICENSES_LABEL_KEY,
      'О программе и лицензии',
    );
  } catch {
    return 'О программе и лицензии';
  }
}

function buildMenuItemFromConfig(item, config, location) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Invalid menu item at ${location}`);
  }

  if (item.type === 'separator') {
    return { type: 'separator' };
  }

  if (typeof item.role === 'string') {
    if (!ALLOWED_MENU_ROLES.has(item.role)) {
      throw new Error(`Unsupported menu role "${item.role}" at ${location}`);
    }

    const roleTemplate = MENU_ROLE_TEMPLATES[item.role];
    const roleItem = {
      ...roleTemplate
    };

    if (typeof item.id === 'string') {
      roleItem.id = item.id;
    }
    if (typeof item.enabled === 'boolean') {
      roleItem.enabled = item.enabled;
    }
    if (typeof item.visible === 'boolean') {
      roleItem.visible = item.visible;
    }
    if (item.visibilityPolicy === 'hidden') {
      roleItem.visible = false;
    } else if (item.visibilityPolicy === 'visible_disabled') {
      roleItem.visible = true;
      roleItem.enabled = false;
    } else if (item.visibilityPolicy === 'visible_enabled') {
      roleItem.visible = true;
      roleItem.enabled = true;
    }

    return roleItem;
  }

  if (typeof item.label !== 'string' || item.label.length === 0) {
    throw new Error(`Menu item label is required at ${location}`);
  }

  const built = {
    label: item.label
  };

  if (typeof item.id === 'string') {
    built.id = item.id;
  }
  if (typeof item.accelerator === 'string') {
    built.accelerator = resolveMenuAccelerator(item.accelerator);
  }
  if (typeof item.enabled === 'boolean') {
    built.enabled = item.enabled;
  }
  if (typeof item.visible === 'boolean') {
    built.visible = item.visible;
  }
  if (item.visibilityPolicy === 'hidden') {
    built.visible = false;
  } else if (item.visibilityPolicy === 'visible_disabled') {
    built.visible = true;
    built.enabled = false;
  } else if (item.visibilityPolicy === 'visible_enabled') {
    built.visible = true;
    built.enabled = true;
  }
  if (typeof item.type === 'string' && item.type !== 'separator') {
    built.type = item.type;
  }
  if (typeof item.checked === 'boolean') {
    built.checked = item.checked;
  }

  if (item.submenuFrom !== undefined) {
    if (item.submenuFrom === 'fonts') {
      built.submenu = buildFontSubmenu(config);
    } else if (item.submenuFrom === MENU_CUSTOMIZATION_SUBMENU_FROM_VISIBILITY_SECTIONS) {
      built.submenu = buildMenuCustomizationVisibilitySectionsSubmenu(config);
    } else if (item.submenuFrom === MENU_CUSTOMIZATION_SUBMENU_FROM_ORDER_SECTIONS) {
      built.submenu = buildMenuCustomizationOrderSectionsSubmenu(config);
    } else {
      throw new Error(`Unknown submenuFrom "${String(item.submenuFrom)}" at ${location}`);
    }
  } else if (Array.isArray(item.items)) {
    built.submenu = item.items.map((child, index) =>
      buildMenuItemFromConfig(child, config, `${location}.items[${index}]`)
    );
  }

  const hasCanonicalCmdId = typeof item.canonicalCmdId === 'string' && item.canonicalCmdId.length > 0;
  const hasCommandField = item.command !== undefined || hasCanonicalCmdId;
  if (hasCommandField && item.actionId !== undefined) {
    throw new Error(`Menu item cannot declare both command and actionId at ${location}`);
  }

  if (hasCommandField) {
    if (item.command !== undefined && typeof item.command !== 'string') {
      throw new Error(`Menu command must be string at ${location}`);
    }
    const sourceCommandId = hasCanonicalCmdId
      ? item.canonicalCmdId
      : item.command;
    if (isMenuLocalCustomizationCommandId(sourceCommandId)) {
      if (sourceCommandId !== MENU_CUSTOMIZATION_COMMAND_RESET
        && (typeof item.actionArg !== 'string' || item.actionArg.length === 0)) {
        throw new Error(`Menu customization command requires actionArg at ${location}`);
      }
      if (sourceCommandId === MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY) {
        built.type = 'checkbox';
        built.checked = isMenuCustomizationSectionVisible(item.actionArg);
      }
      built.click = buildCommandClickHandler(sourceCommandId, {
        actionArg: item.actionArg
      });
      return built;
    }
    const resolved = resolveMenuCommandId(sourceCommandId, { enforceSunset: false });
    if (!resolved.ok) {
      throw new Error(`Menu command namespace validation failed at ${location}`);
    }
    if (resolved.commandId === MENU_PRESENTATION_COMMAND_CLASSIC
      || resolved.commandId === MENU_PRESENTATION_COMMAND_COMPACT) {
      built.type = 'radio';
      built.checked = resolved.commandId === MENU_PRESENTATION_COMMAND_CLASSIC
        ? currentMenuPresentationMode === MENU_PRESENTATION_MODE_CLASSIC
        : currentMenuPresentationMode === MENU_PRESENTATION_MODE_COMPACT;
    } else if (resolved.commandId === MENU_LOCALE_COMMAND_BASE
      || resolved.commandId === MENU_LOCALE_COMMAND_RU
      || resolved.commandId === MENU_LOCALE_COMMAND_EN) {
      built.type = 'radio';
      built.checked = resolved.commandId === MENU_LOCALE_COMMAND_BASE
        ? currentMenuLocale === MENU_LOCALE_MODE_BASE
        : resolved.commandId === MENU_LOCALE_COMMAND_RU
          ? currentMenuLocale === MENU_LOCALE_MODE_RU
          : currentMenuLocale === MENU_LOCALE_MODE_EN;
    }
    built.click = buildCommandClickHandler(resolved.commandId, {
      actionArg: item.actionArg
    });
  } else if (item.actionId !== undefined) {
    if (typeof item.actionId !== 'string') {
      throw new Error(`Menu actionId must be string at ${location}`);
    }
    const commandId = resolveMenuActionToCommand(item.actionId);
    if (isMenuLocalCustomizationCommandId(commandId)) {
      if (commandId !== MENU_CUSTOMIZATION_COMMAND_RESET
        && (typeof item.actionArg !== 'string' || item.actionArg.length === 0)) {
        throw new Error(`Menu customization command requires actionArg at ${location}`);
      }
      if (commandId === MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY) {
        built.type = 'checkbox';
        built.checked = isMenuCustomizationSectionVisible(item.actionArg);
      }
    }
    built.click = buildCommandClickHandler(commandId, {
      actionArg: item.actionArg
    });
  }

  return built;
}

function buildMenuTemplateFromConfig(config) {
  return config.menus.map((menuItem, index) =>
    buildMenuItemFromConfig(menuItem, config, `menus[${index}]`)
  );
}

function buildSafeFallbackMenuTemplate() {
  return [
    {
      id: 'safe-file',
      label: 'Файл',
      submenu: [
        {
          id: 'safe-quit',
          label: 'Выход',
          accelerator: MENU_ACCELERATOR_TOKENS.platformQuit,
          click: buildCommandClickHandler('cmd.app.quit')
        }
      ]
    }
  ];
}

function applySafeFallbackMenu() {
  const fallbackMenu = Menu.buildFromTemplate(buildSafeFallbackMenuTemplate());
  Menu.setApplicationMenu(fallbackMenu);
}

function createMenu() {
  const mode = resolveRuntimeMenuArtifactMode();
  try {
    const runtimeConfig = resolveRuntimeMenuBuildConfig(mode);
    const localizedConfig = applyMenuLocale(runtimeConfig);
    syncCurrentMenuCustomization(localizedConfig);
    const template = buildMenuTemplateFromConfig(localizedConfig);
    const customizedTemplate = applyMenuCustomization(template, localizedConfig);
    ensureAboutLicensesMenuEntry(customizedTemplate);
    const menu = Menu.buildFromTemplate(applyMenuPresentation(customizedTemplate));
    Menu.setApplicationMenu(menu);
  } catch (error) {
    logDevError('createMenu', error);
    applySafeFallbackMenu();

    if (error && error.menuRuntimeBlocking === true) {
      throw error;
    }
    if (shouldFailHardOnMenuConfigError()) {
      throw error;
    }
  }
}

// Подготовка локальных директорий (Documents/craftsman + autosave) при запуске
async function initializeApp() {
  await fileManager.migrateDocumentsFolder();
  await fileManager.ensureDocumentsFolder();
  await ensureAutosaveDirectory();
  await ensureProjectStructure();
}

app.whenReady().then(async () => {
  if (!singleInstanceLockAcquired) {
    return;
  }
  logPerfStage('when-ready');
  app.setName('Yalken');
  await ensureUserDataFolder();
  installContentSecurityPolicy();
  const windowStatePromise = loadWindowStateFromSettings();
  const menuPresentationModePromise = loadMenuPresentationModeFromSettings();
  const menuLocalePromise = loadMenuLocaleFromSettings();
  const menuCustomizationPromise = loadMenuCustomizationFromSettings();
  const initPromise = initializeApp()
    .then(() => {
      logPerfStage('init-complete');
    })
    .catch((error) => {
      logDevError('initializeApp', error);
    });

  await windowStatePromise;
  await menuPresentationModePromise;
  await menuLocalePromise;
  await menuCustomizationPromise;
  logPerfStage('window-state-loaded');
  createWindow();
  try {
    verifyMenuArtifactLockAtRuntime();
  } catch (error) {
    logDevError('verifyMenuArtifactLockAtRuntime', error);
    app.exit(1);
    return;
  }
  try {
    createMenu();
  } catch (error) {
    logDevError('createMenu', error);
    app.exit(1);
    return;
  }
  logPerfStage('window-visible');

  // Запуск автосохранения каждые 15 секунд
  setInterval(() => {
    autoSave().catch((error) => {
      logDevError('autoSave interval', error);
    });
  }, 15000);

  // Запуск создания бэкапов каждую минуту
  setInterval(() => {
    createBackup();
  }, 60000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Позволяем фоновым инициализациям завершиться без блокировки UI
  initPromise.catch(() => {});
});

app.on('before-quit', (event) => {
  if (isQuitting) {
    return;
  }

  event.preventDefault();

  (async () => {
    const canQuit = await confirmDiscardChanges();
    if (!canQuit) {
      return;
    }

    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      await persistWindowState(bounds);
    }

    isQuitting = true;
    app.quit();
  })().catch(() => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = {
  ensureProjectManifest,
  getProjectManifestComparable,
  normalizeProjectManifest,
  persistBookProfileForFile,
  persistProjectManifestAtPath,
  readProjectManifest,
};
