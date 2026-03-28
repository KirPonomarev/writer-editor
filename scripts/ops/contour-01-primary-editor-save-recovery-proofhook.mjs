#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_PATH_OK';
const CONTOUR_ID = 'CONTOUR_01_PRIMARY_EDITOR_LOCAL_SAVE_AND_LAST_STABLE_RECOVERY';
const EXECUTABLE_USER_PATH_ID = 'PRIMARY_EDITOR_LOCAL_SAVE_AND_RECOVER_USER_PATH_V1';
const FAIL_REASON_FORCED_NEGATIVE = 'E_CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_FORCED_NEGATIVE';
const FAIL_REASON_MISSING_ADMITTED_PATH = 'E_CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_ADMITTED_PATH_MISSING';
const FAIL_REASON_UNEXPECTED = 'E_CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_UNEXPECTED';
const FORCE_NEGATIVE_ENV = 'CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_FORCE_NEGATIVE';

const COVERED_SEAMS = Object.freeze([
  'menu-save-command-path',
  'boundary-read-seam',
  'autosave-reopen-recovery-path',
  'ui-recovery-restored-channel',
]);

const OUT_OF_SCOPE_NOT_CLAIMED = Object.freeze([
  'toolbar-save-path',
  'tiptap-ipc-boundary-seam',
  'restore-last-stable-shell-path',
  'safe-reset-shell-path',
]);

const FILES = Object.freeze({
  main: 'src/main.js',
  preload: 'src/preload.js',
  projectCommands: 'src/renderer/commands/projectCommands.mjs',
  menuConfig: 'src/menu/menu-config.v1.json',
  menuNormalizer: 'src/menu/menu-config-normalizer.js',
  editorSource: 'src/renderer/editor.js',
  editorBundle: 'src/renderer/editor.bundle.js',
  runtimeBridge: 'src/renderer/tiptap/runtimeBridge.js',
});

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

function parseArgs(argv) {
  const out = {
    json: false,
    forceNegative: false,
    rootDir: process.cwd(),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--json') {
      out.json = true;
      continue;
    }
    if (token === '--force-negative') {
      out.forceNegative = true;
      continue;
    }
    if (token === '--root' && i + 1 < argv.length) {
      out.rootDir = String(argv[i + 1] || '').trim() || process.cwd();
      i += 1;
    }
  }
  return out;
}

function readText(rootDir, relativePath) {
  const absPath = path.resolve(rootDir, relativePath);
  try {
    return {
      ok: true,
      absPath,
      text: fs.readFileSync(absPath, 'utf8'),
    };
  } catch (error) {
    return {
      ok: false,
      absPath,
      text: '',
      error: error && typeof error.message === 'string' ? error.message : 'READ_FAILED',
    };
  }
}

function walkMenuItems(items, visit) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!isObjectRecord(item)) continue;
    visit(item);
    if (Array.isArray(item.items)) {
      walkMenuItems(item.items, visit);
    }
  }
}

function hasMenuFileSaveEntry(menuJsonText) {
  try {
    const parsed = JSON.parse(menuJsonText);
    const menus = Array.isArray(parsed && parsed.menus) ? parsed.menus : [];
    let found = false;
    for (const menu of menus) {
      if (!isObjectRecord(menu)) continue;
      walkMenuItems(menu.items, (item) => {
        if (item.id === 'file-save' && item.actionId === 'saveDocument') {
          found = true;
        }
      });
    }
    return found;
  } catch {
    return false;
  }
}

function evaluateLivePathChecks(rootDir) {
  const main = readText(rootDir, FILES.main);
  const preload = readText(rootDir, FILES.preload);
  const projectCommands = readText(rootDir, FILES.projectCommands);
  const menuConfig = readText(rootDir, FILES.menuConfig);
  const menuNormalizer = readText(rootDir, FILES.menuNormalizer);
  const editorSource = readText(rootDir, FILES.editorSource);
  const editorBundle = readText(rootDir, FILES.editorBundle);
  const runtimeBridge = readText(rootDir, FILES.runtimeBridge);

  const checkResults = {
    menuManifestFileSave: menuConfig.ok && hasMenuFileSaveEntry(menuConfig.text),
    menuNormalizerSaveAlias: menuNormalizer.ok && /saveDocument:\s*'cmd\.project\.save'/.test(menuNormalizer.text),
    mainMenuFileSavePresentation: main.ok
      && main.text.includes("commandItem('file-save', 'Save', 'cmd.project.save'"),
    mainMenuActionAliasSaveDocument: main.ok
      && /saveDocument:\s*'cmd\.project\.save'/.test(main.text),
    projectCommandsSaveBridge: projectCommands.ok
      && projectCommands.text.includes('registerCatalogCommand(registry, COMMAND_IDS.PROJECT_SAVE')
      && (
        // Legacy direct preload save path (kept for backward compatibility checks).
        projectCommands.text.includes("electronAPI.fileSave({ intent: 'save' })")
        // Canonical command-bus bridge path adopted in Queue 05 prep.
        || (
          projectCommands.text.includes('response = await invokeFileLifecycleBridge(electronAPI, COMMAND_IDS.PROJECT_SAVE);')
          && projectCommands.text.includes("typeof electronAPI.invokeUiCommandBridge === 'function'")
          && projectCommands.text.includes('route: COMMAND_BRIDGE_ROUTE')
        )
      ),
    preloadFileSaveInvoke: preload.ok
      && preload.text.includes("ipcRenderer.invoke('file:save', payload)"),
    mainFileSaveIpcHandler: main.ok
      && main.text.includes("ipcMain.handle('file:save', async () => {")
      && main.text.includes("return executeFileCommand('save');"),
    mainHandleSaveCallsBoundaryRead: main.ok
      && /async function handleSave\(\)[\s\S]*?content = await requestEditorText\(\);/.test(main.text),
    mainHandleSaveAtomicWrite: main.ok
      && main.text.includes('fileManager.writeFileAtomic('),
    mainRequestEditorTextRequest: main.ok
      && main.text.includes('function requestEditorText(timeoutMs = 2500)')
      && main.text.includes("mainWindow.webContents.send('editor:text-request', { requestId });"),
    mainEditorTextResponseListener: main.ok
      && main.text.includes("ipcMain.on('editor:text-response', (_, payload) => {"),
    preloadEditorTextRequestListener: preload.ok
      && preload.text.includes("ipcRenderer.on('editor:text-request', (event, payload) => callback(payload));"),
    preloadEditorTextResponseSender: preload.ok
      && preload.text.includes("ipcRenderer.send('editor:text-response', { requestId, text });"),
    editorSourceComposeDocumentContent: editorSource.ok
      && editorSource.text.includes('function composeDocumentContent()'),
    editorSourceBoundaryBridge: editorSource.ok
      && editorSource.text.includes('window.electronAPI.onEditorTextRequest(({ requestId }) => {')
      && editorSource.text.includes('window.electronAPI.sendEditorTextResponse(requestId, composeDocumentContent());'),
    editorBundleBoundaryBridge: editorBundle.ok
      && editorBundle.text.includes('onEditorTextRequest')
      && editorBundle.text.includes('sendEditorTextResponse'),
    autosaveRestoreFunction: main.ok
      && main.text.includes('async function restoreAutosaveIfExists()'),
    autosaveRestoreRead: main.ok
      && main.text.includes("const content = await fs.readFile(autosavePath, 'utf-8');"),
    autosaveRestoreSendsEditorText: main.ok
      && main.text.includes('sendEditorText(await attachProjectIdToEditorPayload({ content'),
    autosaveRestoreCalledOnReopen: main.ok
      && main.text.includes('const restored = await restoreAutosaveIfExists();'),
    autosaveRecoveryChannelSend: main.ok
      && main.text.includes("mainWindow.webContents.send('ui:recovery-restored', {"),
    autosaveRecoveryMessage: main.ok
      && main.text.includes("message: 'Recovered autosave on reopen path'"),
    autosaveRecoverySource: main.ok
      && main.text.includes("source: 'autosave'"),
    preloadRecoveryChannelListener: preload.ok
      && preload.text.includes("ipcRenderer.on('ui:recovery-restored', (event, payload) => callback(payload));"),
    editorSourceRecoveryListener: editorSource.ok
      && editorSource.text.includes('window.electronAPI.onRecoveryRestored((payload) => {'),
    runtimeBridgeRecoveryNormalization: runtimeBridge.ok
      && runtimeBridge.text.includes('function normalizeRecoveryPayload(payload)')
      && runtimeBridge.text.includes('Recovered autosave on reopen path'),
    editorBundleRecoveryListener: editorBundle.ok
      && editorBundle.text.includes('onRecoveryRestored')
      && editorBundle.text.includes('Recovered autosave on reopen path'),
  };

  const seamToChecks = {
    'menu-save-command-path': [
      'menuManifestFileSave',
      'menuNormalizerSaveAlias',
      'mainMenuFileSavePresentation',
      'mainMenuActionAliasSaveDocument',
      'projectCommandsSaveBridge',
      'preloadFileSaveInvoke',
      'mainFileSaveIpcHandler',
      'mainHandleSaveCallsBoundaryRead',
      'mainHandleSaveAtomicWrite',
    ],
    'boundary-read-seam': [
      'mainRequestEditorTextRequest',
      'mainEditorTextResponseListener',
      'preloadEditorTextRequestListener',
      'preloadEditorTextResponseSender',
      'editorSourceComposeDocumentContent',
      'editorSourceBoundaryBridge',
      'editorBundleBoundaryBridge',
    ],
    'autosave-reopen-recovery-path': [
      'autosaveRestoreFunction',
      'autosaveRestoreRead',
      'autosaveRestoreSendsEditorText',
      'autosaveRestoreCalledOnReopen',
      'autosaveRecoveryChannelSend',
      'autosaveRecoveryMessage',
      'autosaveRecoverySource',
    ],
    'ui-recovery-restored-channel': [
      'autosaveRecoveryChannelSend',
      'preloadRecoveryChannelListener',
      'editorSourceRecoveryListener',
      'runtimeBridgeRecoveryNormalization',
      'editorBundleRecoveryListener',
    ],
  };

  const seamResults = {};
  const missingChecks = [];
  for (const seamId of COVERED_SEAMS) {
    const checkIds = seamToChecks[seamId] || [];
    const seamOk = checkIds.every((checkId) => checkResults[checkId] === true);
    seamResults[seamId] = seamOk;
    if (!seamOk) {
      for (const checkId of checkIds) {
        if (checkResults[checkId] !== true) {
          missingChecks.push(`${seamId}:${checkId}`);
        }
      }
    }
  }

  const artifactAwareness = {
    editorBundleChecked: true,
    editorBundlePresent: editorBundle.ok,
    editorBundleBoundaryBridge: checkResults.editorBundleBoundaryBridge === true,
    editorBundleRecoveryListener: checkResults.editorBundleRecoveryListener === true,
  };

  return {
    seamResults,
    missingChecks,
    checkResults,
    artifactAwareness,
  };
}

function baseState() {
  return {
    contourId: CONTOUR_ID,
    executableUserPathId: EXECUTABLE_USER_PATH_ID,
    coveredSeams: [...COVERED_SEAMS],
    outOfScopeNotClaimed: [...OUT_OF_SCOPE_NOT_CLAIMED],
    provenOutOfScopeClaims: [],
    scopeStatement: 'exact-admitted-live-path-only',
  };
}

export function evaluateContour01PrimaryEditorSaveRecoveryProofhook(input = {}) {
  const forceNegative = input.forceNegative === true
    || String(process.env[FORCE_NEGATIVE_ENV] || '').trim() === '1';

  if (forceNegative) {
    return {
      ...baseState(),
      ok: false,
      [TOKEN_NAME]: 0,
      failReason: FAIL_REASON_FORCED_NEGATIVE,
      seamResults: Object.fromEntries(COVERED_SEAMS.map((seamId) => [seamId, false])),
      checkResults: {},
      missingChecks: ['FORCED_NEGATIVE_PATH'],
      forcedNegative: true,
      artifactAwareness: {
        editorBundleChecked: false,
        editorBundlePresent: null,
        editorBundleBoundaryBridge: false,
        editorBundleRecoveryListener: false,
      },
    };
  }

  try {
    const rootDir = String(input.rootDir || process.cwd()).trim() || process.cwd();
    const evaluated = evaluateLivePathChecks(rootDir);
    const ok = COVERED_SEAMS.every((seamId) => evaluated.seamResults[seamId] === true);

    return {
      ...baseState(),
      ok,
      [TOKEN_NAME]: ok ? 1 : 0,
      failReason: ok ? '' : FAIL_REASON_MISSING_ADMITTED_PATH,
      seamResults: evaluated.seamResults,
      checkResults: evaluated.checkResults,
      missingChecks: evaluated.missingChecks,
      forcedNegative: false,
      artifactAwareness: evaluated.artifactAwareness,
    };
  } catch (error) {
    return {
      ...baseState(),
      ok: false,
      [TOKEN_NAME]: 0,
      failReason: FAIL_REASON_UNEXPECTED,
      seamResults: Object.fromEntries(COVERED_SEAMS.map((seamId) => [seamId, false])),
      checkResults: {},
      missingChecks: ['UNEXPECTED_ERROR'],
      forcedNegative: false,
      artifactAwareness: {
        editorBundleChecked: false,
        editorBundlePresent: null,
        editorBundleBoundaryBridge: false,
        editorBundleRecoveryListener: false,
      },
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`FAIL_REASON=${state.failReason}`);
  console.log(`COVERED_SEAMS=${state.coveredSeams.join(',')}`);
  console.log(`OUT_OF_SCOPE_NOT_CLAIMED=${state.outOfScopeNotClaimed.join(',')}`);
  console.log(`MISSING_CHECKS=${state.missingChecks.join(',')}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateContour01PrimaryEditorSaveRecoveryProofhook({
    forceNegative: args.forceNegative,
    rootDir: args.rootDir,
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
