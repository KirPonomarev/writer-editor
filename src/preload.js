const { contextBridge, ipcRenderer } = require('electron');
const EXPORT_DOCX_MIN_CHANNEL = 'u:cmd:project:export:docxMin:v1';
const IMPORT_MARKDOWN_V1_CHANNEL = 'm:cmd:project:import:markdownV1:v1';
const EXPORT_MARKDOWN_V1_CHANNEL = 'm:cmd:project:export:markdownV1:v1';
const FLOW_OPEN_V1_CHANNEL = 'm:cmd:project:flow:open:v1';
const FLOW_SAVE_V1_CHANNEL = 'm:cmd:project:flow:save:v1';
const UI_COMMAND_BRIDGE_CHANNEL = 'ui:command-bridge';
const WORKSPACE_QUERY_BRIDGE_CHANNEL = 'ui:workspace-query-bridge';
const SAVE_LIFECYCLE_SIGNAL_BRIDGE_CHANNEL = 'ui:save-lifecycle-signal-bridge';
const COMMAND_BUS_ROUTE = 'command.bus';
const DOCUMENT_OPEN_COMMAND_ID = 'cmd.project.document.open';
const TREE_COMMAND_IDS = Object.freeze({
  CREATE_NODE: 'cmd.project.tree.createNode',
  RENAME_NODE: 'cmd.project.tree.renameNode',
  DELETE_NODE: 'cmd.project.tree.deleteNode',
  REORDER_NODE: 'cmd.project.tree.reorderNode',
});
const TREE_ACTION_TO_COMMAND_ID = Object.freeze({
  createNode: TREE_COMMAND_IDS.CREATE_NODE,
  renameNode: TREE_COMMAND_IDS.RENAME_NODE,
  deleteNode: TREE_COMMAND_IDS.DELETE_NODE,
  reorderNode: TREE_COMMAND_IDS.REORDER_NODE,
});

function normalizeRequestRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeRequestPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function invokeUiCommand(commandId, payload = {}) {
  return ipcRenderer.invoke(UI_COMMAND_BRIDGE_CHANNEL, {
    route: COMMAND_BUS_ROUTE,
    commandId: typeof commandId === 'string' ? commandId : '',
    payload: normalizeRequestPayload(payload),
  });
}

function dispatchTreeCommand(request = {}) {
  const safeRequest = normalizeRequestRecord(request);
  const commandId = typeof safeRequest.commandId === 'string' && safeRequest.commandId.length > 0
    ? safeRequest.commandId
    : TREE_ACTION_TO_COMMAND_ID[
      typeof safeRequest.action === 'string' ? safeRequest.action : ''
    ];
  if (!Object.values(TREE_COMMAND_IDS).includes(commandId)) {
    return Promise.resolve({ ok: false, error: 'TREE_COMMAND_NOT_ALLOWED' });
  }
  return invokeUiCommand(commandId, safeRequest.payload);
}

// Экспорт безопасного API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  onFontChanged: (callback) => {
    ipcRenderer.on('font-changed', (event, fontFamily) => callback(fontFamily));
  },
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },
  onEditorSetText: (callback) => {
    ipcRenderer.on('editor:set-text', (event, text) => callback(text));
  },
  onEditorTextRequest: (callback) => {
    ipcRenderer.on('editor:text-request', (event, payload) => callback(payload));
  },
  sendEditorTextResponse: (requestId, text) => {
    ipcRenderer.send('editor:text-response', { requestId, text });
  },
  onEditorSetFontSize: (callback) => {
    ipcRenderer.on('editor:set-font-size', (event, payload) => callback(payload));
  },
  newFile: () => {
    ipcRenderer.send('ui:new');
  },
  openFile: () => {
    ipcRenderer.send('ui:open');
  },
  saveFile: () => {
    ipcRenderer.send('ui:save');
  },
  saveAs: () => {
    ipcRenderer.send('ui:save-as');
  },
  /**
   * @param {unknown} payload
   * @returns {Promise<{ ok: false, reason: "not-implemented" }>}
   */
  fileSave: (payload) => {
    return ipcRenderer.invoke('file:save', payload);
  },
  /**
   * @param {unknown} payload
   * @returns {Promise<{ ok: false, reason: "not-implemented" }>}
   */
  fileSaveAs: (payload) => {
    return ipcRenderer.invoke('file:save-as', payload);
  },
  /**
   * @param {unknown} payload
   * @returns {Promise<{ ok: false, reason: "not-implemented" }>}
   */
  fileOpen: (payload) => {
    return ipcRenderer.invoke('file:open', payload);
  },
  openSection: (sectionName) => {
    return ipcRenderer.invoke('ui:open-section', { sectionName });
  },
  getProjectTree: (tab) => {
    return ipcRenderer.invoke(WORKSPACE_QUERY_BRIDGE_CHANNEL, {
      queryId: 'query.projectTree',
      payload: { tab },
    });
  },
  openDocument: (payload) => {
    return invokeUiCommand(DOCUMENT_OPEN_COMMAND_ID, payload);
  },
  dispatchTreeCommand: (request) => {
    return dispatchTreeCommand(request);
  },
  createNode: (payload) => {
    return dispatchTreeCommand({
      commandId: TREE_COMMAND_IDS.CREATE_NODE,
      payload,
    });
  },
  renameNode: (payload) => {
    return dispatchTreeCommand({
      commandId: TREE_COMMAND_IDS.RENAME_NODE,
      payload,
    });
  },
  deleteNode: (payload) => {
    return dispatchTreeCommand({
      commandId: TREE_COMMAND_IDS.DELETE_NODE,
      payload,
    });
  },
  reorderNode: (payload) => {
    return dispatchTreeCommand({
      commandId: TREE_COMMAND_IDS.REORDER_NODE,
      payload,
    });
  },
  exportDocxMin: (payload) => {
    return ipcRenderer.invoke(EXPORT_DOCX_MIN_CHANNEL, payload);
  },
  importMarkdownV1: (payload) => {
    return ipcRenderer.invoke(IMPORT_MARKDOWN_V1_CHANNEL, payload);
  },
  exportMarkdownV1: (payload) => {
    return ipcRenderer.invoke(EXPORT_MARKDOWN_V1_CHANNEL, payload);
  },
  openFlowModeV1: () => {
    return ipcRenderer.invoke(FLOW_OPEN_V1_CHANNEL);
  },
  saveFlowModeV1: (payload) => {
    return ipcRenderer.invoke(FLOW_SAVE_V1_CHANNEL, payload);
  },
  invokeUiCommandBridge: (request) => {
    const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
      ? request
      : {};
    const route = typeof safeRequest.route === 'string' ? safeRequest.route : '';
    const commandId = typeof safeRequest.commandId === 'string' ? safeRequest.commandId : '';
    const payload = safeRequest.payload && typeof safeRequest.payload === 'object' && !Array.isArray(safeRequest.payload)
      ? safeRequest.payload
      : {};
    return ipcRenderer.invoke(UI_COMMAND_BRIDGE_CHANNEL, { route, commandId, payload });
  },
  invokeWorkspaceQueryBridge: (request) => {
    const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
      ? request
      : {};
    const queryId = typeof safeRequest.queryId === 'string' ? safeRequest.queryId : '';
    const payload = safeRequest.payload && typeof safeRequest.payload === 'object' && !Array.isArray(safeRequest.payload)
      ? safeRequest.payload
      : {};
    return ipcRenderer.invoke(WORKSPACE_QUERY_BRIDGE_CHANNEL, { queryId, payload });
  },
  invokeSaveLifecycleSignalBridge: (request) => {
    const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
      ? request
      : {};
    const signalId = typeof safeRequest.signalId === 'string' ? safeRequest.signalId : '';
    const payload = safeRequest.payload && typeof safeRequest.payload === 'object' && !Array.isArray(safeRequest.payload)
      ? safeRequest.payload
      : {};
    return ipcRenderer.invoke(SAVE_LIFECYCLE_SIGNAL_BRIDGE_CHANNEL, { signalId, payload });
  },
  setTheme: (theme) => {
    ipcRenderer.send('ui:set-theme', theme);
  },
  setFont: (fontFamily) => {
    ipcRenderer.send('ui:set-font', fontFamily);
  },
  setFontSizePx: (px) => {
    ipcRenderer.send('ui:set-font-size', px);
  },
  changeFontSize: (action) => {
    ipcRenderer.send('ui:font-size', action);
  },
  minimizeWindow: () => {
    ipcRenderer.send('ui:window-minimize');
  },
  notifyDirtyState: (state) => {
    ipcRenderer.send('dirty-changed', state);
  },
  requestAutoSave: () => {
    return ipcRenderer.invoke('ui:request-autosave');
  },
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, status) => callback(status));
  },
  onRecoveryRestored: (callback) => {
    ipcRenderer.on('ui:recovery-restored', (event, payload) => callback(payload));
  },
  onRuntimeCommand: (callback) => {
    ipcRenderer.on('ui:runtime-command', (event, payload) => callback(payload));
  },
  getCollabScopeLocal: () => {
    return ipcRenderer.invoke('ui:get-collab-scope-local');
  },
  onSetDirty: (callback) => {
    ipcRenderer.on('set-dirty', (event, state) => callback(state));
  }
});
