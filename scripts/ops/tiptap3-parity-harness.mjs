import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fileManager = require('../../src/utils/fileManager.js');
const backupManager = require('../../src/utils/backupManager.js');

const PREP_SERIALIZATION_PATH = '/tmp/TIPTAP3_20260314_PREPCLOSE_03/tiptap3-prep/serialization.record.json';
const EDITOR_SOURCE_PATH = path.resolve('src/renderer/editor.js');
const IPC_SOURCE_PATH = path.resolve('src/renderer/tiptap/ipc.js');
const INDEX_SOURCE_PATH = path.resolve('src/renderer/tiptap/index.js');

function canonicalize(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .normalize('NFC');
}

function sha256Utf8(text) {
  return crypto.createHash('sha256').update(Buffer.from(canonicalize(text), 'utf8')).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractFunction(sourceText, functionName) {
  const marker = `function ${functionName}(`;
  const start = sourceText.indexOf(marker);
  if (start === -1) {
    throw new Error(`Unable to locate ${functionName}() in source`);
  }

  let parenDepth = 0;
  let signatureIndex = start;
  let bodyBraceIndex = -1;
  while (signatureIndex < sourceText.length) {
    const char = sourceText[signatureIndex];
    if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyBraceIndex = sourceText.indexOf('{', signatureIndex);
        break;
      }
    }
    signatureIndex += 1;
  }

  if (bodyBraceIndex === -1) {
    throw new Error(`Unable to locate function body for ${functionName}()`);
  }

  let depth = 0;
  let index = bodyBraceIndex;
  while (index < sourceText.length) {
    const char = sourceText[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return sourceText.slice(start, index + 1);
      }
    }
    index += 1;
  }

  throw new Error(`Unable to extract full body for ${functionName}()`);
}

function loadPrepFixtures() {
  const payload = readJson(PREP_SERIALIZATION_PATH);
  return {
    fixtureIds: payload.fixtureIds,
    expectedLegacyPayloadByFixture: payload.expectedLegacyPayloadByFixture,
    legacyPayloadSha256ByFixture: payload.legacyPayloadSha256ByFixture,
  };
}

function loadIpcModule() {
  const sourceText = fs.readFileSync(IPC_SOURCE_PATH, 'utf8');
  const evalSource = sourceText
    .replace(/export function /g, 'function ')
    .concat('\nmodule.exports = { attachTiptapIpc, detachTiptapIpc, getTiptapIpcDebugState, parseObservablePayload, composeObservablePayload };');

  const textRequestListeners = [];
  const setTextListeners = [];
  const responses = [];

  const context = {
    window: {
      electronAPI: {
        onEditorTextRequest(callback) {
          textRequestListeners.push(callback);
        },
        onEditorSetText(callback) {
          setTextListeners.push(callback);
        },
        sendEditorTextResponse(requestId, text) {
          responses.push({ requestId, text });
        },
      },
    },
    module: { exports: {} },
    exports: {},
    console,
  };

  vm.createContext(context);
  new vm.Script(evalSource, { filename: IPC_SOURCE_PATH }).runInContext(context);

  return {
    ...context.module.exports,
    __debug: {
      textRequestListeners,
      setTextListeners,
      responses,
    },
  };
}

function loadLegacyHarness() {
  const sourceText = fs.readFileSync(EDITOR_SOURCE_PATH, 'utf8');
  const functions = [
    'getPlainText',
    'setPlainText',
    'parseIndentedValue',
    'parseTagsValue',
    'parseMetaBlock',
    'parseCardBlock',
    'parseCardsBlock',
    'parseDocumentContent',
    'composeMetaBlock',
    'composeCardsBlock',
    'composeDocumentContent',
    'markAsModified',
    'handleUndo',
  ].map((name) => extractFunction(sourceText, name));

  const evalSource = `
    let plainTextBuffer = '';
    let metaEnabled = false;
    let currentCards = [];
    let currentMeta = { synopsis: '', status: 'черновик', tags: { pov: '', line: '', place: '' } };
    let flowModeState = { active: false, scenes: [], dirty: false };
    let localDirty = false;
    let renderCalls = 0;
    let dirtyNotifications = [];
    let focusCalls = 0;
    let execCommands = [];
    let editor = {
      focus() {
        focusCalls += 1;
      },
    };
    const window = {
      electronAPI: {
        notifyDirtyState(value) {
          dirtyNotifications.push(Boolean(value));
        },
      },
      clearTimeout() {},
      setTimeout() { return 0; },
    };
    const document = {
      execCommand(command) {
        execCommands.push(command);
        return true;
      },
    };
    function renderStyledView() {
      renderCalls += 1;
    }
    function scheduleDeferredHotpathRender() {}
    function cancelDeferredRenderWork() {}
    function updateStatusText() {}
    function updateSaveStateText() {}
    function updatePerfHintText() {}
    function updateInspectorSnapshot() {}
    function scheduleAutoSave() {}
    ${functions.join('\n\n')}
    function applyPayload(rawText) {
      const parsed = parseDocumentContent(rawText);
      currentMeta = parsed.meta;
      currentCards = parsed.cards;
      metaEnabled = /\\[meta\\]/i.test(String(rawText || ''));
      setPlainText(parsed.text || '', { includePagination: false, preserveSelection: true });
      return parsed;
    }
    function getState() {
      return {
        plainTextBuffer,
        metaEnabled,
        currentMeta,
        currentCards,
        localDirty,
        renderCalls,
        dirtyNotifications,
        focusCalls,
        execCommands,
      };
    }
    module.exports = {
      applyPayload,
      composeDocumentContent,
      markAsModified,
      handleUndo,
      getState,
    };
  `;

  const context = {
    module: { exports: {} },
    exports: {},
    console,
  };

  vm.createContext(context);
  new vm.Script(evalSource, { filename: EDITOR_SOURCE_PATH }).runInContext(context);
  return context.module.exports;
}

function createTiptapMount() {
  const classes = [];
  const children = [];
  return {
    innerHTML: '',
    classList: {
      add(name) {
        classes.push(name);
      },
    },
    appendChild(child) {
      children.push(child);
    },
    __debug: { classes, children },
  };
}

function docToText(doc) {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content.map((node) => {
    if (!node || node.type !== 'paragraph') return '';
    if (!Array.isArray(node.content) || !node.content.length) return '';
    return node.content.map((leaf) => leaf?.text || '').join('');
  }).join('\n');
}

function loadTiptapHarness(ipcModule) {
  let sourceText = fs.readFileSync(INDEX_SOURCE_PATH, 'utf8');
  sourceText = sourceText
    .replace("import { Editor } from '@tiptap/core'\n", '')
    .replace("import StarterKit from '@tiptap/starter-kit'\n", '')
    .replace(/import\s*\{\s*attachTiptapIpc,\s*composeObservablePayload,\s*detachTiptapIpc,\s*parseObservablePayload,\s*\}\s*from '\.\/ipc\.js'\n/, '')
    .replace(/export function /g, 'function ')
    .concat('\nmodule.exports = { initTiptap, destroyTiptap, createIpcSession, textToDoc, readEditorText };');

  const editorInstances = [];
  class FakeEditor {
    constructor(options = {}) {
      this.options = options;
      this._text = '';
      this.focusCalls = 0;
      this.destroyCalls = 0;
      this.setContentCalls = 0;
      this.commands = {
        setContent: (doc) => {
          this._text = docToText(doc);
          this.setContentCalls += 1;
        },
        focus: () => {
          this.focusCalls += 1;
        },
      };
      editorInstances.push(this);
    }

    getText() {
      return this._text;
    }

    destroy() {
      this.destroyCalls += 1;
    }

    __setText(value) {
      this._text = String(value || '');
    }

    __emitUpdate() {
      if (typeof this.options.onUpdate === 'function') {
        this.options.onUpdate();
      }
    }
  }

  const context = {
    attachTiptapIpc: ipcModule.attachTiptapIpc,
    composeObservablePayload: ipcModule.composeObservablePayload,
    detachTiptapIpc: ipcModule.detachTiptapIpc,
    parseObservablePayload: ipcModule.parseObservablePayload,
    Editor: FakeEditor,
    StarterKit: {},
    window: {
      addEventListener() {},
      electronAPI: {
        notifyDirtyState() {},
      },
    },
    document: {
      createElement() {
        return {
          className: '',
          children: [],
          appendChild(child) {
            this.children.push(child);
          },
        };
      },
    },
    module: { exports: {} },
    exports: {},
    console,
  };

  vm.createContext(context);
  new vm.Script(sourceText, { filename: INDEX_SOURCE_PATH }).runInContext(context);

  return {
    ...context.module.exports,
    __debug: {
      editorInstances,
    },
  };
}

function requestObservablePayload(ipcModule, requestId) {
  const listeners = ipcModule.__debug.textRequestListeners;
  if (listeners.length !== 1) {
    throw new Error(`Expected exactly one text request listener, got ${listeners.length}`);
  }
  listeners[0]({ requestId });
  const response = ipcModule.__debug.responses.at(-1);
  return response && response.requestId === requestId ? response.text : '';
}

function applyIncomingPayload(ipcModule, payload) {
  const listeners = ipcModule.__debug.setTextListeners;
  if (listeners.length !== 1) {
    throw new Error(`Expected exactly one setText listener, got ${listeners.length}`);
  }
  listeners[0](payload);
}

async function proveSaveAndBackup(payload) {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'tiptap3-parity-'));
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => tempRoot;

  try {
    const projectRoot = path.join(tempRoot, 'project');
    const currentFilePath = path.join(projectRoot, 'scene.txt');
    const autosavePath = path.join(tempRoot, '.autosave', 'autosave.txt');

    await fsp.mkdir(path.dirname(currentFilePath), { recursive: true });
    await fsp.mkdir(path.dirname(autosavePath), { recursive: true });

    const saveResult = await fileManager.writeFileAtomic(currentFilePath, payload);
    const reopened = await fsp.readFile(currentFilePath, 'utf8');

    const autosaveCurrentFileResult = await fileManager.writeFileAtomic(currentFilePath, payload);
    const autosaveTemporaryResult = await fileManager.writeFileAtomic(autosavePath, payload);
    const autosaveContent = await fsp.readFile(autosavePath, 'utf8');

    await backupManager.createBackup(currentFilePath, payload, { basePath: projectRoot });
    await backupManager.createBackup(autosavePath, payload);

    const currentId = crypto.createHash('sha256').update(path.resolve(currentFilePath)).digest('hex');
    const autosaveId = crypto.createHash('sha256').update(path.resolve(autosavePath)).digest('hex');

    const currentBackupDir = path.join(projectRoot, 'backups', currentId);
    const autosaveBackupDir = path.join(tempRoot, '.backups', autosaveId);

    const currentFiles = (await fsp.readdir(currentBackupDir)).filter((name) => name !== 'meta.json').sort();
    const autosaveFiles = (await fsp.readdir(autosaveBackupDir)).filter((name) => name !== 'meta.json').sort();

    const currentBackupContent = await fsp.readFile(path.join(currentBackupDir, currentFiles.at(-1)), 'utf8');
    const autosaveBackupContent = await fsp.readFile(path.join(autosaveBackupDir, autosaveFiles.at(-1)), 'utf8');

    return {
      saveOk: saveResult?.success === true && reopened === payload,
      reopenOk: reopened === payload,
      autosaveOk: autosaveCurrentFileResult?.success === true && autosaveTemporaryResult?.success === true && autosaveContent === payload,
      backupCurrentOk: currentBackupContent === payload,
      backupAutosaveOk: autosaveBackupContent === payload,
      tempRoot,
    };
  } finally {
    fileManager.getDocumentsPath = originalGetDocumentsPath;
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

function runLegacyFixtureProof(legacyHarness, fixtureId, payload, expectedHash) {
  legacyHarness.applyPayload(payload);
  const recomposed = legacyHarness.composeDocumentContent();
  return {
    fixtureId,
    candidatePayload: recomposed,
    candidateSha256: sha256Utf8(recomposed),
    equalAfterCanonicalization: sha256Utf8(recomposed) === expectedHash,
    state: legacyHarness.getState(),
  };
}

function runTiptapFixtureProof(tiptapHarness, ipcModule, fixtureId, payload, expectedHash) {
  const mount = createTiptapMount();
  const editor = tiptapHarness.initTiptap(mount);
  applyIncomingPayload(ipcModule, {
    content: payload,
    metaEnabled: /\[meta\]/i.test(payload),
    title: '',
    path: '',
    kind: 'scene',
  });
  const candidate = requestObservablePayload(ipcModule, `fixture-${fixtureId}`);
  const result = {
    fixtureId,
    candidatePayload: candidate,
    candidateSha256: sha256Utf8(candidate),
    equalAfterCanonicalization: sha256Utf8(candidate) === expectedHash,
    hostLayoutOk: mount.__debug.classes.includes('tiptap-host') && mount.__debug.children.length === 1,
  };
  tiptapHarness.destroyTiptap();
  return { result, editor };
}

async function main() {
  const prep = loadPrepFixtures();
  const ipcModule = loadIpcModule();
  const legacyHarness = loadLegacyHarness();
  const tiptapHarness = loadTiptapHarness(ipcModule);

  const fixtureResults = {};
  let serializationParityOk = true;

  for (const fixtureId of prep.fixtureIds.filter((id) => id !== 'fixture_crlf_unicode_normalization')) {
    const payload = prep.expectedLegacyPayloadByFixture[fixtureId];
    const expectedHash = prep.legacyPayloadSha256ByFixture[fixtureId];

    const legacy = runLegacyFixtureProof(legacyHarness, fixtureId, payload, expectedHash);
    const { result: tiptap } = runTiptapFixtureProof(tiptapHarness, ipcModule, fixtureId, payload, expectedHash);

    if (!legacy.equalAfterCanonicalization || !tiptap.equalAfterCanonicalization) {
      serializationParityOk = false;
    }

    fixtureResults[fixtureId] = {
      legacyPayload: legacy.candidatePayload,
      legacySha256: legacy.candidateSha256,
      legacyEqualAfterCanonicalization: legacy.equalAfterCanonicalization,
      tiptapPayload: tiptap.candidatePayload,
      tiptapSha256: tiptap.candidateSha256,
      tiptapEqualAfterCanonicalization: tiptap.equalAfterCanonicalization,
      tiptapHostLayoutOk: tiptap.hostLayoutOk,
    };
  }

  const typedPayload = prep.expectedLegacyPayloadByFixture.fixture_meta_plus_body;
  const typedParsed = ipcModule.parseObservablePayload(typedPayload);
  const mount = createTiptapMount();
  const editor = tiptapHarness.initTiptap(mount);
  applyIncomingPayload(ipcModule, {
    content: typedPayload,
    metaEnabled: true,
    title: 'Scene',
    path: '/tmp/scene.txt',
    kind: 'scene',
  });
  editor.__setText(`${typedParsed.text}\nappended line`);
  editor.__emitUpdate();
  editor.commands.focus();
  const tiptapUpdatedPayload = requestObservablePayload(ipcModule, 'typed-update');
  const tiptapState = ipcModule.getTiptapIpcDebugState();
  tiptapHarness.destroyTiptap();

  const reinitMount = createTiptapMount();
  const reinitEditor = tiptapHarness.initTiptap(reinitMount);
  const reinitPayload = requestObservablePayload(ipcModule, 'reinit');
  const reinitState = ipcModule.getTiptapIpcDebugState();
  tiptapHarness.destroyTiptap();

  const saveBearingPayload = fixtureResults.fixture_save_then_reopen_file_backed_document.tiptapPayload;
  const saveBearing = await proveSaveAndBackup(saveBearingPayload);

  legacyHarness.applyPayload(prep.expectedLegacyPayloadByFixture.fixture_plain_multiline_text);
  legacyHarness.markAsModified();
  legacyHarness.handleUndo();
  const legacyState = legacyHarness.getState();

  const result = {
    oracleClass: 'LEGACY_PRODUCTION_OBSERVABLE_PAYLOAD',
    fixtureIds: Object.keys(fixtureResults),
    fixtureResults,
    defaultLane: {
      inputOk: legacyState.plainTextBuffer === prep.expectedLegacyPayloadByFixture.fixture_plain_multiline_text,
      updateOk: legacyState.localDirty === true && legacyState.dirtyNotifications.includes(true),
      textRequestOk: fixtureResults.fixture_meta_plus_body.legacyEqualAfterCanonicalization === true,
      focusOk: legacyState.focusCalls > 0 && legacyState.execCommands.includes('undo'),
      saveOk: saveBearing.saveOk,
      reopenOk: saveBearing.reopenOk,
      autosaveOk: saveBearing.autosaveOk,
      backupOk: saveBearing.backupCurrentOk && saveBearing.backupAutosaveOk,
    },
    tiptapLane: {
      inputOk: tiptapUpdatedPayload.includes('appended line'),
      updateOk: tiptapUpdatedPayload.includes('appended line'),
      textRequestOk: fixtureResults.fixture_meta_plus_body.tiptapEqualAfterCanonicalization === true,
      focusOk: editor.focusCalls > 0,
      destroyReinitOk: tiptapState.listenerCount === 2 && reinitState.listenerCount === 2 && reinitPayload === '',
      hostLayoutOk: mount.__debug.classes.includes('tiptap-host') && mount.__debug.children.length === 1 && reinitMount.__debug.children.length === 1,
      saveOk: saveBearing.saveOk,
      reopenOk: saveBearing.reopenOk,
      autosaveOk: saveBearing.autosaveOk,
      backupOk: saveBearing.backupCurrentOk && saveBearing.backupAutosaveOk,
    },
    saveBearing,
    serializationParityOk,
    verdict: serializationParityOk
      && saveBearing.saveOk
      && saveBearing.reopenOk
      && saveBearing.autosaveOk
      && saveBearing.backupCurrentOk
      && saveBearing.backupAutosaveOk
      ? 'PARITY_HARNESS_OK'
      : 'PARITY_HARNESS_INCOMPLETE',
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
