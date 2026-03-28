import { COMMAND_CATALOG_V1, getCommandCatalogById } from './command-catalog.v1.mjs';

const COMMAND_KEY_TO_ID = Object.freeze(
  Object.fromEntries(COMMAND_CATALOG_V1.map((entry) => [entry.key, entry.id])),
);

export const COMMAND_IDS = Object.freeze({
  PROJECT_OPEN: COMMAND_KEY_TO_ID.PROJECT_OPEN,
  PROJECT_SAVE: COMMAND_KEY_TO_ID.PROJECT_SAVE,
  PROJECT_EXPORT_DOCX_MIN: COMMAND_KEY_TO_ID.PROJECT_EXPORT_DOCX_MIN,
  PROJECT_IMPORT_MARKDOWN_V1: COMMAND_KEY_TO_ID.PROJECT_IMPORT_MARKDOWN_V1,
  PROJECT_EXPORT_MARKDOWN_V1: COMMAND_KEY_TO_ID.PROJECT_EXPORT_MARKDOWN_V1,
  PROJECT_FLOW_OPEN_V1: COMMAND_KEY_TO_ID.PROJECT_FLOW_OPEN_V1,
  PROJECT_FLOW_SAVE_V1: COMMAND_KEY_TO_ID.PROJECT_FLOW_SAVE_V1,
});

export const EXTRA_COMMAND_IDS = Object.freeze({
  PROJECT_NEW: 'cmd.project.new',
  PROJECT_DOCUMENT_OPEN: 'cmd.project.document.open',
  PROJECT_SAVE_AS: 'cmd.project.saveAs',
  TREE_CREATE_NODE: 'cmd.project.tree.createNode',
  TREE_RENAME_NODE: 'cmd.project.tree.renameNode',
  TREE_DELETE_NODE: 'cmd.project.tree.deleteNode',
  TREE_REORDER_NODE: 'cmd.project.tree.reorderNode',
  EDIT_UNDO: 'cmd.project.edit.undo',
  EDIT_REDO: 'cmd.project.edit.redo',
  EDIT_FIND: 'cmd.project.edit.find',
  EDIT_REPLACE: 'cmd.project.edit.replace',
  VIEW_ZOOM_OUT: 'cmd.project.view.zoomOut',
  VIEW_ZOOM_IN: 'cmd.project.view.zoomIn',
  VIEW_TOGGLE_WRAP: 'cmd.project.view.toggleWrap',
  INSERT_MARKDOWN_PROMPT: 'cmd.project.insert.markdownPrompt',
  INSERT_FLOW_OPEN: 'cmd.project.insert.flowOpen',
  INSERT_ADD_CARD: 'cmd.project.insert.addCard',
  FORMAT_ALIGN_LEFT: 'cmd.project.format.alignLeft',
  FORMAT_ALIGN_CENTER: 'cmd.project.format.alignCenter',
  FORMAT_ALIGN_RIGHT: 'cmd.project.format.alignRight',
  FORMAT_ALIGN_JUSTIFY: 'cmd.project.format.alignJustify',
  PLAN_FLOW_SAVE: 'cmd.project.plan.flowSave',
  REVIEW_EXPORT_MARKDOWN: 'cmd.project.review.exportMarkdown',
});

export const UI_COMMAND_IDS = Object.freeze({
  THEME_SET: 'cmd.ui.theme.set',
  FONT_SET: 'cmd.ui.font.set',
  FONT_SIZE_SET: 'cmd.ui.fontSize.set',
});

export const LEGACY_ACTION_TO_COMMAND = Object.freeze({
  new: 'cmd.project.new',
  open: 'cmd.project.open',
  openDocument: 'cmd.project.open',
  save: 'cmd.project.save',
  saveDocument: 'cmd.project.save',
  'save-as': 'cmd.project.saveAs',
  undo: 'cmd.project.edit.undo',
  redo: 'cmd.project.edit.redo',
  find: 'cmd.project.edit.find',
  search: 'cmd.project.edit.find',
  replace: 'cmd.project.edit.replace',
  'zoom-out': 'cmd.project.view.zoomOut',
  'zoom-in': 'cmd.project.view.zoomIn',
  'toggle-wrap': 'cmd.project.view.toggleWrap',
  'import-markdown-v1': 'cmd.project.insert.markdownPrompt',
  'flow-open-v1': 'cmd.project.insert.flowOpen',
  'add-card': 'cmd.project.insert.addCard',
  'align-left': 'cmd.project.format.alignLeft',
  'align-center': 'cmd.project.format.alignCenter',
  'align-right': 'cmd.project.format.alignRight',
  'align-justify': 'cmd.project.format.alignJustify',
  'flow-save-v1': 'cmd.project.plan.flowSave',
  'export-markdown-v1': 'cmd.project.review.exportMarkdown',
  'export-docx-min': 'cmd.project.export.docxMin',
  exportDocxMin: 'cmd.project.export.docxMin',
});

// Canonical Core command IDs used by CORE_SOT checks.
export const CORE_COMMAND_CANON = Object.freeze([
  'project.create',
  'project.applyTextEdit',
]);
const EXPORT_DOCX_MIN_OP = 'u:cmd:project:export:docxMin:v1';
const IMPORT_MARKDOWN_V1_OP = 'm:cmd:project:import:markdownV1:v1';
const EXPORT_MARKDOWN_V1_OP = 'm:cmd:project:export:markdownV1:v1';
const FLOW_OPEN_V1_OP = 'm:cmd:project:flow:open:v1';
const FLOW_SAVE_V1_OP = 'm:cmd:project:flow:save:v1';
const COMMAND_BRIDGE_ROUTE = 'command.bus';

function fail(code, op, reason, details) {
  const error = { code, op, reason };
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = details;
  }
  return { ok: false, error };
}

function ok(value) {
  return { ok: true, value };
}

function normalizeSafetyMode(input) {
  return input === 'compat' ? 'compat' : 'strict';
}

function registerCatalogCommand(registry, commandId, handler) {
  const meta = getCommandCatalogById(commandId);
  if (!meta) {
    throw new Error(`COMMAND_CATALOG_MISSING:${commandId}`);
  }
  registry.registerCommand(
    {
      id: meta.id,
      label: meta.label,
      group: meta.group,
      surface: [...meta.surface],
      hotkey: meta.hotkey,
    },
    handler,
  );
}

async function runUiAction(uiActions, actionName, commandId, payload = {}) {
  const action = uiActions && typeof uiActions[actionName] === 'function'
    ? uiActions[actionName]
    : null;
  if (!action) {
    return fail(
      'E_COMMAND_FAILED',
      commandId,
      'UI_ACTION_UNAVAILABLE',
      { action: actionName },
    );
  }

  try {
    const result = await action(payload);
    return ok({
      performed: true,
      action: actionName,
      result: result && typeof result === 'object' && !Array.isArray(result)
        ? result
        : null,
    });
  } catch (error) {
    return fail(
      'E_COMMAND_FAILED',
      commandId,
      'UI_ACTION_FAILED',
      { action: actionName, message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
    );
  }
}

function getElectronApiMethod(electronAPI, methodName) {
  if (!electronAPI || typeof methodName !== 'string' || methodName.length === 0) return null;
  const candidate = electronAPI[methodName];
  if (typeof candidate !== 'function') return null;
  return candidate.bind(electronAPI);
}

function resolveFileLifecycleFallbackInvoker(electronAPI, commandId) {
  if (commandId === EXTRA_COMMAND_IDS.PROJECT_NEW) {
    const fileOpen = getElectronApiMethod(electronAPI, 'fileOpen');
    if (fileOpen) return () => fileOpen({ intent: 'new' });
    const newFile = getElectronApiMethod(electronAPI, 'newFile');
    if (newFile) return () => newFile();
    const openFile = getElectronApiMethod(electronAPI, 'openFile');
    if (openFile) return () => openFile();
    return null;
  }
  if (commandId === COMMAND_IDS.PROJECT_OPEN) {
    const fileOpen = getElectronApiMethod(electronAPI, 'fileOpen');
    if (fileOpen) return () => fileOpen({ intent: 'open' });
    const openFile = getElectronApiMethod(electronAPI, 'openFile');
    if (openFile) return () => openFile();
    return null;
  }
  if (commandId === COMMAND_IDS.PROJECT_SAVE) {
    const fileSave = getElectronApiMethod(electronAPI, 'fileSave');
    if (fileSave) return () => fileSave({ intent: 'save' });
    const saveFile = getElectronApiMethod(electronAPI, 'saveFile');
    if (saveFile) return () => saveFile();
    return null;
  }
  if (commandId === EXTRA_COMMAND_IDS.PROJECT_SAVE_AS) {
    const fileSaveAs = getElectronApiMethod(electronAPI, 'fileSaveAs');
    if (fileSaveAs) return () => fileSaveAs({ intent: 'saveAs' });
    const saveAs = getElectronApiMethod(electronAPI, 'saveAs');
    if (saveAs) return () => saveAs();
    return null;
  }
  return null;
}

async function invokeFileLifecycleBridge(electronAPI, commandId) {
  if (electronAPI && typeof electronAPI.invokeUiCommandBridge === 'function') {
    return electronAPI.invokeUiCommandBridge({
      route: COMMAND_BRIDGE_ROUTE,
      commandId,
      payload: {},
    });
  }

  // Compatibility fallback for non-preload runtimes used by local parity harnesses.
  const fallbackInvoker = resolveFileLifecycleFallbackInvoker(electronAPI, commandId);
  if (!fallbackInvoker) {
    throw new Error('ELECTRON_API_UNAVAILABLE');
  }
  const legacyResult = await fallbackInvoker();
  if (legacyResult && typeof legacyResult === 'object' && !Array.isArray(legacyResult)) {
    return legacyResult;
  }
  return { ok: true };
}

export function resolveLegacyActionToCommand(actionId, context = {}) {
  if (actionId === 'save' && context && context.flowModeActive === true) {
    return COMMAND_IDS.PROJECT_FLOW_SAVE_V1;
  }
  if (typeof actionId !== 'string') return null;
  return LEGACY_ACTION_TO_COMMAND[actionId] || null;
}

export function createLegacyActionBridge(executeCommand) {
  return async function executeLegacyAction(actionId, options = {}) {
    const commandId = resolveLegacyActionToCommand(actionId, options.context || {});
    if (!commandId) {
      return { handled: false, commandId: null, result: null };
    }
    if (typeof executeCommand !== 'function') {
      return fail('E_COMMAND_FAILED', commandId, 'COMMAND_EXECUTOR_INVALID');
    }
    const payload = options.payload && typeof options.payload === 'object' && !Array.isArray(options.payload)
      ? options.payload
      : {};
    const result = await executeCommand(commandId, payload);
    return { handled: true, commandId, result };
  };
}

export function registerProjectCommands(registry, options = {}) {
  const electronAPI = options.electronAPI || null;
  const uiActions = options.uiActions && typeof options.uiActions === 'object' ? options.uiActions : null;

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.PROJECT_NEW,
      label: 'New Project',
      group: 'file',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+N',
    },
    async () => {
      if (!electronAPI || typeof electronAPI !== 'object') {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.PROJECT_NEW, 'ELECTRON_API_UNAVAILABLE');
      }

      let response;
      try {
        response = await invokeFileLifecycleBridge(electronAPI, EXTRA_COMMAND_IDS.PROJECT_NEW);
      } catch (error) {
        return fail(
          'E_COMMAND_FAILED',
          EXTRA_COMMAND_IDS.PROJECT_NEW,
          'FILE_NEW_IPC_FAILED',
          { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
        );
      }

      const bridged = response && typeof response === 'object' && !Array.isArray(response)
        && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? response.value
        : response;
      if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
        return ok({ created: true });
      }
      return fail(
        'E_COMMAND_FAILED',
        EXTRA_COMMAND_IDS.PROJECT_NEW,
        bridged && typeof bridged.reason === 'string'
          ? bridged.reason
          : bridged && typeof bridged.error === 'string'
            ? bridged.error
            : response && typeof response.reason === 'string'
              ? response.reason
              : 'FILE_NEW_FAILED',
      );
    },
  );

  registerCatalogCommand(registry, COMMAND_IDS.PROJECT_OPEN, async () => {
    if (!electronAPI || typeof electronAPI !== 'object') {
      return fail('E_COMMAND_FAILED', COMMAND_IDS.PROJECT_OPEN, 'ELECTRON_API_UNAVAILABLE');
    }

    let response;
    try {
      response = await invokeFileLifecycleBridge(electronAPI, COMMAND_IDS.PROJECT_OPEN);
    } catch (error) {
      return fail(
        'E_COMMAND_FAILED',
        COMMAND_IDS.PROJECT_OPEN,
        'FILE_OPEN_IPC_FAILED',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }

    const bridged = response && typeof response === 'object' && !Array.isArray(response)
      && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
      ? response.value
      : response;
    if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
      return ok({ opened: true });
    }
    return fail(
      'E_COMMAND_FAILED',
      COMMAND_IDS.PROJECT_OPEN,
      bridged && typeof bridged.reason === 'string'
        ? bridged.reason
        : bridged && typeof bridged.error === 'string'
          ? bridged.error
          : response && typeof response.reason === 'string'
            ? response.reason
            : 'FILE_OPEN_FAILED',
    );
  });

  registerCatalogCommand(registry, COMMAND_IDS.PROJECT_SAVE, async () => {
    if (!electronAPI || typeof electronAPI !== 'object') {
      return fail('E_COMMAND_FAILED', COMMAND_IDS.PROJECT_SAVE, 'ELECTRON_API_UNAVAILABLE');
    }

    let response;
    try {
      response = await invokeFileLifecycleBridge(electronAPI, COMMAND_IDS.PROJECT_SAVE);
    } catch (error) {
      return fail(
        'E_COMMAND_FAILED',
        COMMAND_IDS.PROJECT_SAVE,
        'FILE_SAVE_IPC_FAILED',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }

    const bridged = response && typeof response === 'object' && !Array.isArray(response)
      && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
      ? response.value
      : response;
    if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
      return ok({ saved: true });
    }
    return fail(
      'E_COMMAND_FAILED',
      COMMAND_IDS.PROJECT_SAVE,
      bridged && typeof bridged.reason === 'string'
        ? bridged.reason
        : bridged && typeof bridged.error === 'string'
          ? bridged.error
          : response && typeof response.reason === 'string'
            ? response.reason
            : 'FILE_SAVE_FAILED',
    );
  });

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.PROJECT_SAVE_AS,
      label: 'Save Project As',
      group: 'file',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Shift+S',
    },
    async () => {
      if (!electronAPI || typeof electronAPI !== 'object') {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.PROJECT_SAVE_AS, 'ELECTRON_API_UNAVAILABLE');
      }

      let response;
      try {
        response = await invokeFileLifecycleBridge(electronAPI, EXTRA_COMMAND_IDS.PROJECT_SAVE_AS);
      } catch (error) {
        return fail(
          'E_COMMAND_FAILED',
          EXTRA_COMMAND_IDS.PROJECT_SAVE_AS,
          'FILE_SAVE_AS_IPC_FAILED',
          { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
        );
      }

      const bridged = response && typeof response === 'object' && !Array.isArray(response)
        && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? response.value
        : response;
      if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
        return ok({ savedAs: true });
      }
      return fail(
        'E_COMMAND_FAILED',
        EXTRA_COMMAND_IDS.PROJECT_SAVE_AS,
        bridged && typeof bridged.reason === 'string'
          ? bridged.reason
          : bridged && typeof bridged.error === 'string'
            ? bridged.error
            : response && typeof response.reason === 'string'
              ? response.reason
              : 'FILE_SAVE_AS_FAILED',
      );
    },
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,
      label: 'Open Project Document Node',
      group: 'file',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => {
      if (!electronAPI || typeof electronAPI.invokeUiCommandBridge !== 'function') {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN, 'ELECTRON_API_UNAVAILABLE');
      }
      const path = typeof input.path === 'string' ? input.path.trim() : '';
      const title = typeof input.title === 'string' ? input.title : '';
      const kind = typeof input.kind === 'string' ? input.kind : '';
      if (!path) {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN, 'DOCUMENT_PATH_REQUIRED');
      }

      let response;
      try {
        response = await electronAPI.invokeUiCommandBridge({
          route: COMMAND_BRIDGE_ROUTE,
          commandId: EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,
          payload: { path, title, kind },
        });
      } catch (error) {
        return fail(
          'E_COMMAND_FAILED',
          EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,
          'OPEN_DOCUMENT_IPC_FAILED',
          { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
        );
      }

      const bridged = response && typeof response === 'object' && !Array.isArray(response)
        && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? response.value
        : response;
      if (bridged && bridged.cancelled) {
        return ok({ opened: false, cancelled: true, path, kind });
      }
      if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
        return ok({ opened: true, path, kind });
      }
      return fail(
        'E_COMMAND_FAILED',
        EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,
        bridged && typeof bridged.reason === 'string'
          ? bridged.reason
          : bridged && typeof bridged.error === 'string'
            ? bridged.error
            : response && typeof response.reason === 'string'
              ? response.reason
              : 'OPEN_DOCUMENT_FAILED',
      );
    },
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.TREE_CREATE_NODE,
      label: 'Create Project Tree Node',
      group: 'insert',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => {
      if (!electronAPI || typeof electronAPI.invokeUiCommandBridge !== 'function') {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_CREATE_NODE, 'ELECTRON_API_UNAVAILABLE');
      }
      const parentPath = typeof input.parentPath === 'string' ? input.parentPath.trim() : '';
      const kind = typeof input.kind === 'string' ? input.kind.trim() : '';
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!parentPath || !kind || !name) {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_CREATE_NODE, 'TREE_CREATE_PAYLOAD_INVALID');
      }

      let response;
      try {
        response = await electronAPI.invokeUiCommandBridge({
          route: COMMAND_BRIDGE_ROUTE,
          commandId: EXTRA_COMMAND_IDS.TREE_CREATE_NODE,
          payload: { parentPath, kind, name },
        });
      } catch (error) {
        return fail(
          'E_COMMAND_FAILED',
          EXTRA_COMMAND_IDS.TREE_CREATE_NODE,
          'TREE_CREATE_IPC_FAILED',
          { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
        );
      }

      const bridged = response && typeof response === 'object' && !Array.isArray(response)
        && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? response.value
        : response;
      if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
        return ok({ created: true, parentPath, kind, name });
      }
      return fail(
        'E_COMMAND_FAILED',
        EXTRA_COMMAND_IDS.TREE_CREATE_NODE,
        bridged && typeof bridged.reason === 'string'
          ? bridged.reason
          : bridged && typeof bridged.error === 'string'
            ? bridged.error
            : response && typeof response.reason === 'string'
              ? response.reason
              : 'TREE_CREATE_FAILED',
      );
    },
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.TREE_RENAME_NODE,
      label: 'Rename Project Tree Node',
      group: 'edit',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => {
      if (!electronAPI || typeof electronAPI.invokeUiCommandBridge !== 'function') {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_RENAME_NODE, 'ELECTRON_API_UNAVAILABLE');
      }
      const path = typeof input.path === 'string' ? input.path.trim() : '';
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!path || !name) {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_RENAME_NODE, 'TREE_RENAME_PAYLOAD_INVALID');
      }

      let response;
      try {
        response = await electronAPI.invokeUiCommandBridge({
          route: COMMAND_BRIDGE_ROUTE,
          commandId: EXTRA_COMMAND_IDS.TREE_RENAME_NODE,
          payload: { path, name },
        });
      } catch (error) {
        return fail(
          'E_COMMAND_FAILED',
          EXTRA_COMMAND_IDS.TREE_RENAME_NODE,
          'TREE_RENAME_IPC_FAILED',
          { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
        );
      }

      const bridged = response && typeof response === 'object' && !Array.isArray(response)
        && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? response.value
        : response;
      if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
        return ok({
          renamed: true,
          path: typeof bridged.path === 'string' && bridged.path.trim().length > 0 ? bridged.path : path,
          oldPath: path,
        });
      }
      return fail(
        'E_COMMAND_FAILED',
        EXTRA_COMMAND_IDS.TREE_RENAME_NODE,
        bridged && typeof bridged.reason === 'string'
          ? bridged.reason
          : bridged && typeof bridged.error === 'string'
            ? bridged.error
            : response && typeof response.reason === 'string'
              ? response.reason
              : 'TREE_RENAME_FAILED',
      );
    },
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.TREE_DELETE_NODE,
      label: 'Delete Project Tree Node',
      group: 'edit',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => {
      if (!electronAPI || typeof electronAPI.invokeUiCommandBridge !== 'function') {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_DELETE_NODE, 'ELECTRON_API_UNAVAILABLE');
      }
      const path = typeof input.path === 'string' ? input.path.trim() : '';
      if (!path) {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_DELETE_NODE, 'TREE_DELETE_PAYLOAD_INVALID');
      }

      let response;
      try {
        response = await electronAPI.invokeUiCommandBridge({
          route: COMMAND_BRIDGE_ROUTE,
          commandId: EXTRA_COMMAND_IDS.TREE_DELETE_NODE,
          payload: { path },
        });
      } catch (error) {
        return fail(
          'E_COMMAND_FAILED',
          EXTRA_COMMAND_IDS.TREE_DELETE_NODE,
          'TREE_DELETE_IPC_FAILED',
          { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
        );
      }

      const bridged = response && typeof response === 'object' && !Array.isArray(response)
        && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? response.value
        : response;
      if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
        return ok({ deleted: true, path });
      }
      return fail(
        'E_COMMAND_FAILED',
        EXTRA_COMMAND_IDS.TREE_DELETE_NODE,
        bridged && typeof bridged.reason === 'string'
          ? bridged.reason
          : bridged && typeof bridged.error === 'string'
            ? bridged.error
            : response && typeof response.reason === 'string'
              ? response.reason
              : 'TREE_DELETE_FAILED',
      );
    },
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.TREE_REORDER_NODE,
      label: 'Reorder Project Tree Node',
      group: 'edit',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => {
      if (!electronAPI || typeof electronAPI.invokeUiCommandBridge !== 'function') {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_REORDER_NODE, 'ELECTRON_API_UNAVAILABLE');
      }
      const path = typeof input.path === 'string' ? input.path.trim() : '';
      const direction = typeof input.direction === 'string' ? input.direction.trim() : '';
      if (!path || (direction !== 'up' && direction !== 'down')) {
        return fail('E_COMMAND_FAILED', EXTRA_COMMAND_IDS.TREE_REORDER_NODE, 'TREE_REORDER_PAYLOAD_INVALID');
      }

      let response;
      try {
        response = await electronAPI.invokeUiCommandBridge({
          route: COMMAND_BRIDGE_ROUTE,
          commandId: EXTRA_COMMAND_IDS.TREE_REORDER_NODE,
          payload: { path, direction },
        });
      } catch (error) {
        return fail(
          'E_COMMAND_FAILED',
          EXTRA_COMMAND_IDS.TREE_REORDER_NODE,
          'TREE_REORDER_IPC_FAILED',
          { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
        );
      }

      const bridged = response && typeof response === 'object' && !Array.isArray(response)
        && response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? response.value
        : response;
      if (bridged && (bridged.ok === 1 || bridged.ok === true)) {
        return ok({
          reordered: true,
          path: typeof bridged.path === 'string' && bridged.path.trim().length > 0 ? bridged.path : path,
          oldPath: path,
          direction,
        });
      }
      return fail(
        'E_COMMAND_FAILED',
        EXTRA_COMMAND_IDS.TREE_REORDER_NODE,
        bridged && typeof bridged.reason === 'string'
          ? bridged.reason
          : bridged && typeof bridged.error === 'string'
            ? bridged.error
            : response && typeof response.reason === 'string'
              ? response.reason
              : 'TREE_REORDER_FAILED',
      );
    },
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.EDIT_UNDO,
      label: 'Undo',
      group: 'edit',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Z',
    },
    async () => runUiAction(uiActions, 'undo', EXTRA_COMMAND_IDS.EDIT_UNDO),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.EDIT_REDO,
      label: 'Redo',
      group: 'edit',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Shift+Z',
    },
    async () => runUiAction(uiActions, 'redo', EXTRA_COMMAND_IDS.EDIT_REDO),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.EDIT_FIND,
      label: 'Find',
      group: 'edit',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+F',
    },
    async () => runUiAction(uiActions, 'find', EXTRA_COMMAND_IDS.EDIT_FIND),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.EDIT_REPLACE,
      label: 'Replace',
      group: 'edit',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+H',
    },
    async () => runUiAction(uiActions, 'replace', EXTRA_COMMAND_IDS.EDIT_REPLACE),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.VIEW_ZOOM_OUT,
      label: 'Zoom Out',
      group: 'view',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+-',
    },
    async () => runUiAction(uiActions, 'zoomOut', EXTRA_COMMAND_IDS.VIEW_ZOOM_OUT),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.VIEW_ZOOM_IN,
      label: 'Zoom In',
      group: 'view',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+=',
    },
    async () => runUiAction(uiActions, 'zoomIn', EXTRA_COMMAND_IDS.VIEW_ZOOM_IN),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.VIEW_TOGGLE_WRAP,
      label: 'Toggle Wrap',
      group: 'view',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Alt+W',
    },
    async () => runUiAction(uiActions, 'toggleWrap', EXTRA_COMMAND_IDS.VIEW_TOGGLE_WRAP),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.INSERT_MARKDOWN_PROMPT,
      label: 'Insert Markdown v1',
      group: 'insert',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Shift+I',
    },
    async () => runUiAction(uiActions, 'insertMarkdownPrompt', EXTRA_COMMAND_IDS.INSERT_MARKDOWN_PROMPT),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.INSERT_FLOW_OPEN,
      label: 'Insert Flow Mode',
      group: 'insert',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Shift+F',
    },
    async () => runUiAction(uiActions, 'insertFlowOpen', EXTRA_COMMAND_IDS.INSERT_FLOW_OPEN),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.INSERT_ADD_CARD,
      label: 'Insert Card',
      group: 'insert',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Shift+K',
    },
    async () => runUiAction(uiActions, 'insertAddCard', EXTRA_COMMAND_IDS.INSERT_ADD_CARD),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT,
      label: 'Align Left',
      group: 'format',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Alt+1',
    },
    async () => runUiAction(uiActions, 'formatAlignLeft', EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.FORMAT_ALIGN_CENTER,
      label: 'Align Center',
      group: 'format',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Alt+2',
    },
    async () => runUiAction(uiActions, 'formatAlignCenter', EXTRA_COMMAND_IDS.FORMAT_ALIGN_CENTER),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.FORMAT_ALIGN_RIGHT,
      label: 'Align Right',
      group: 'format',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Alt+3',
    },
    async () => runUiAction(uiActions, 'formatAlignRight', EXTRA_COMMAND_IDS.FORMAT_ALIGN_RIGHT),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.FORMAT_ALIGN_JUSTIFY,
      label: 'Align Justify',
      group: 'format',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Alt+4',
    },
    async () => runUiAction(uiActions, 'formatAlignJustify', EXTRA_COMMAND_IDS.FORMAT_ALIGN_JUSTIFY),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.PLAN_FLOW_SAVE,
      label: 'Plan Flow Save',
      group: 'plan',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Shift+S',
    },
    async () => runUiAction(uiActions, 'planFlowSave', EXTRA_COMMAND_IDS.PLAN_FLOW_SAVE),
  );

  registry.registerCommand(
    {
      id: EXTRA_COMMAND_IDS.REVIEW_EXPORT_MARKDOWN,
      label: 'Review Export Markdown',
      group: 'review',
      surface: ['menu', 'palette', 'toolbar'],
      hotkey: 'Cmd/Ctrl+Shift+M',
    },
    async () => runUiAction(uiActions, 'reviewExportMarkdown', EXTRA_COMMAND_IDS.REVIEW_EXPORT_MARKDOWN),
  );

  registry.registerCommand(
    {
      id: UI_COMMAND_IDS.THEME_SET,
      label: 'Set Theme',
      group: 'view',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => runUiAction(uiActions, 'setTheme', UI_COMMAND_IDS.THEME_SET, input),
  );

  registry.registerCommand(
    {
      id: UI_COMMAND_IDS.FONT_SET,
      label: 'Set Font',
      group: 'format',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => runUiAction(uiActions, 'setFont', UI_COMMAND_IDS.FONT_SET, input),
  );

  registry.registerCommand(
    {
      id: UI_COMMAND_IDS.FONT_SIZE_SET,
      label: 'Set Font Size',
      group: 'format',
      surface: ['internal'],
      hotkey: '',
    },
    async (input = {}) => runUiAction(uiActions, 'setFontSize', UI_COMMAND_IDS.FONT_SIZE_SET, input),
  );

  registerCatalogCommand(registry, COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, async (input = {}) => {
    if (!electronAPI || typeof electronAPI.exportDocxMin !== 'function') {
      return fail(
        'E_UNWIRED_EXPORT_BACKEND',
        COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN,
        'EXPORT_DOCXMIN_BACKEND_NOT_WIRED',
      );
    }

    const payload = {
      requestId: typeof input.requestId === 'string' && input.requestId.length > 0
        ? input.requestId
        : 'u3-export-docxmin-request',
      outPath: typeof input.outPath === 'string' ? input.outPath : '',
      outDir: typeof input.outDir === 'string' ? input.outDir : '',
      bufferSource: typeof input.bufferSource === 'string' ? input.bufferSource : '',
      options: input.options && typeof input.options === 'object' && !Array.isArray(input.options)
        ? input.options
        : {},
    };

    let response;
    try {
      response = await electronAPI.exportDocxMin(payload);
    } catch (error) {
      return fail(
        'E_COMMAND_FAILED',
        COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN,
        'EXPORT_DOCXMIN_IPC_FAILED',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }

    if (response && response.ok === 1) {
      return ok({
        exported: true,
        outPath: typeof response.outPath === 'string' ? response.outPath : '',
        bytesWritten: Number.isInteger(response.bytesWritten) ? response.bytesWritten : 0,
      });
    }

    if (response && response.ok === 0 && response.error && typeof response.error === 'object') {
      const error = response.error;
      return fail(
        typeof error.code === 'string' ? error.code : 'E_EXPORT_DOCXMIN_FAILED',
        typeof error.op === 'string' ? error.op : EXPORT_DOCX_MIN_OP,
        typeof error.reason === 'string' ? error.reason : 'EXPORT_DOCXMIN_FAILED',
        error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : undefined,
      );
    }

    return fail(
      'E_COMMAND_FAILED',
      COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN,
      'EXPORT_DOCXMIN_INVALID_RESPONSE',
    );
  });

  registerCatalogCommand(registry, COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, async (input = {}) => {
    if (!electronAPI || typeof electronAPI.importMarkdownV1 !== 'function') {
      return fail(
        'MDV1_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1,
        'IMPORT_MARKDOWN_BACKEND_NOT_WIRED',
      );
    }

    const payload = {
      text: typeof input.text === 'string'
        ? input.text
        : (typeof input.markdown === 'string' ? input.markdown : ''),
      sourceName: typeof input.sourceName === 'string' ? input.sourceName : '',
      sourcePath: typeof input.sourcePath === 'string' ? input.sourcePath : '',
      limits: input.limits && typeof input.limits === 'object' && !Array.isArray(input.limits)
        ? input.limits
        : {},
    };

    let response;
    try {
      response = await electronAPI.importMarkdownV1(payload);
    } catch (error) {
      return fail(
        'MDV1_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1,
        'IMPORT_MARKDOWN_IPC_FAILED',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }

    if (response && response.ok === 1 && response.scene && typeof response.scene === 'object') {
      return ok({
        imported: true,
        scene: response.scene,
        lossReport: response.lossReport && typeof response.lossReport === 'object'
          ? response.lossReport
          : { count: 0, items: [] },
      });
    }

    if (response && response.ok === 0 && response.error && typeof response.error === 'object') {
      const error = response.error;
      return fail(
        typeof error.code === 'string' ? error.code : 'MDV1_INTERNAL_ERROR',
        typeof error.op === 'string' ? error.op : IMPORT_MARKDOWN_V1_OP,
        typeof error.reason === 'string' ? error.reason : 'IMPORT_MARKDOWN_FAILED',
        error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : undefined,
      );
    }

    return fail(
      'MDV1_INTERNAL_ERROR',
      COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1,
      'IMPORT_MARKDOWN_INVALID_RESPONSE',
    );
  });

  registerCatalogCommand(registry, COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, async (input = {}) => {
    if (!electronAPI || typeof electronAPI.exportMarkdownV1 !== 'function') {
      return fail(
        'MDV1_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1,
        'EXPORT_MARKDOWN_BACKEND_NOT_WIRED',
      );
    }
    if (!input || typeof input !== 'object' || Array.isArray(input) || !input.scene || typeof input.scene !== 'object') {
      return fail(
        'MDV1_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1,
        'EXPORT_MARKDOWN_SCENE_REQUIRED',
      );
    }

    const payload = {
      scene: input.scene,
      outPath: typeof input.outPath === 'string' ? input.outPath : '',
      snapshotLimit: Number.isInteger(input.snapshotLimit) && input.snapshotLimit >= 1
        ? input.snapshotLimit
        : 3,
      safetyMode: normalizeSafetyMode(input.safetyMode),
      limits: input.limits && typeof input.limits === 'object' && !Array.isArray(input.limits)
        ? input.limits
        : {},
    };

    let response;
    try {
      response = await electronAPI.exportMarkdownV1(payload);
    } catch (error) {
      return fail(
        'MDV1_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1,
        'EXPORT_MARKDOWN_IPC_FAILED',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }

    if (response && response.ok === 1 && typeof response.markdown === 'string') {
      const output = {
        exported: true,
        markdown: response.markdown,
        lossReport: response.lossReport && typeof response.lossReport === 'object'
          ? response.lossReport
          : { count: 0, items: [] },
      };

      if (typeof response.outPath === 'string' && response.outPath.length > 0) {
        output.outPath = response.outPath;
      }
      if (Number.isInteger(response.bytesWritten) && response.bytesWritten >= 0) {
        output.bytesWritten = response.bytesWritten;
      }
      if (typeof response.safetyMode === 'string' && response.safetyMode.length > 0) {
        output.safetyMode = response.safetyMode;
      }
      if (response.snapshotCreated === true) {
        output.snapshotCreated = true;
        if (typeof response.snapshotPath === 'string' && response.snapshotPath.length > 0) {
          output.snapshotPath = response.snapshotPath;
        }
      }

      return ok(output);
    }

    if (response && response.ok === 0 && response.error && typeof response.error === 'object') {
      const error = response.error;
      return fail(
        typeof error.code === 'string' ? error.code : 'MDV1_INTERNAL_ERROR',
        typeof error.op === 'string' ? error.op : EXPORT_MARKDOWN_V1_OP,
        typeof error.reason === 'string' ? error.reason : 'EXPORT_MARKDOWN_FAILED',
        error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : undefined,
      );
    }

    return fail(
      'MDV1_INTERNAL_ERROR',
      COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1,
      'EXPORT_MARKDOWN_INVALID_RESPONSE',
    );
  });

  registerCatalogCommand(registry, COMMAND_IDS.PROJECT_FLOW_OPEN_V1, async () => {
    if (!electronAPI || typeof electronAPI.openFlowModeV1 !== 'function') {
      return fail(
        'M7_FLOW_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_FLOW_OPEN_V1,
        'FLOW_OPEN_BACKEND_NOT_WIRED',
      );
    }

    let response;
    try {
      response = await electronAPI.openFlowModeV1();
    } catch (error) {
      return fail(
        'M7_FLOW_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_FLOW_OPEN_V1,
        'FLOW_OPEN_IPC_FAILED',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }

    if (response && response.ok === 1 && Array.isArray(response.scenes)) {
      return ok({
        opened: true,
        scenes: response.scenes,
      });
    }

    if (response && response.ok === 0 && response.error && typeof response.error === 'object') {
      const error = response.error;
      return fail(
        typeof error.code === 'string' ? error.code : 'M7_FLOW_INTERNAL_ERROR',
        typeof error.op === 'string' ? error.op : FLOW_OPEN_V1_OP,
        typeof error.reason === 'string' ? error.reason : 'FLOW_OPEN_FAILED',
        error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : undefined,
      );
    }

    return fail(
      'M7_FLOW_INTERNAL_ERROR',
      COMMAND_IDS.PROJECT_FLOW_OPEN_V1,
      'FLOW_OPEN_INVALID_RESPONSE',
    );
  });

  registerCatalogCommand(registry, COMMAND_IDS.PROJECT_FLOW_SAVE_V1, async (input = {}) => {
    if (!electronAPI || typeof electronAPI.saveFlowModeV1 !== 'function') {
      return fail(
        'M7_FLOW_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_FLOW_SAVE_V1,
        'FLOW_SAVE_BACKEND_NOT_WIRED',
      );
    }

    if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.scenes)) {
      return fail(
        'M7_FLOW_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_FLOW_SAVE_V1,
        'FLOW_SAVE_SCENES_REQUIRED',
      );
    }

    let response;
    try {
      response = await electronAPI.saveFlowModeV1({ scenes: input.scenes });
    } catch (error) {
      return fail(
        'M7_FLOW_INTERNAL_ERROR',
        COMMAND_IDS.PROJECT_FLOW_SAVE_V1,
        'FLOW_SAVE_IPC_FAILED',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      );
    }

    if (response && response.ok === 1) {
      return ok({
        saved: true,
        savedCount: Number.isInteger(response.savedCount) ? response.savedCount : input.scenes.length,
      });
    }

    if (response && response.ok === 0 && response.error && typeof response.error === 'object') {
      const error = response.error;
      return fail(
        typeof error.code === 'string' ? error.code : 'M7_FLOW_INTERNAL_ERROR',
        typeof error.op === 'string' ? error.op : FLOW_SAVE_V1_OP,
        typeof error.reason === 'string' ? error.reason : 'FLOW_SAVE_FAILED',
        error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : undefined,
      );
    }

    return fail(
      'M7_FLOW_INTERNAL_ERROR',
      COMMAND_IDS.PROJECT_FLOW_SAVE_V1,
      'FLOW_SAVE_INVALID_RESPONSE',
    );
  });
}
