import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 30000;
const RESULT_PREFIX = 'REVIEW_BRIDGE_CANONICAL_UI_E2E_RESULT:';
const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');

function parseResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith(RESULT_PREFIX));
  if (!line) return null;
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

function createChildSource(tempRoot) {
  return `\
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, Menu, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const tempRoot = ${JSON.stringify(tempRoot)};
const RESULT_PREFIX = ${JSON.stringify(RESULT_PREFIX)};
const projectName = '\\u0420\\u043e\\u043c\\u0430\\u043d';
const sceneName = '\\u0447\\u0435\\u0440\\u043d\\u043e\\u0432\\u0438\\u043a';
const beforeText = 'Alpha beta gamma.';
const afterText = 'Alpha delta gamma.';
const packetPath = path.join(tempRoot, 'review-packet.json');
const exportedPacketPath = path.join(tempRoot, 'exported-review-packet.json');
let selectedPacketPath = packetPath;
const networkRequests = [];
const dialogCalls = [];

function emit(payload) {
  process.stdout.write(RESULT_PREFIX + JSON.stringify(payload) + '\\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate, label, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error('WAIT_TIMEOUT:' + label);
}

for (const dirName of ['appData', 'userData', 'documents']) {
  fs.mkdirSync(path.join(tempRoot, dirName), { recursive: true });
}

dialog.showOpenDialog = async (_window, options = {}) => {
  const title = typeof options.title === 'string' ? options.title : '';
  dialogCalls.push({ method: 'showOpenDialog', title });
  if (title === 'Import Review Packet') {
    return { canceled: false, filePaths: [selectedPacketPath] };
  }
  return { canceled: true, filePaths: [] };
};
dialog.showSaveDialog = async (_window, options = {}) => {
  const title = typeof options.title === 'string' ? options.title : '';
  dialogCalls.push({
    method: 'showSaveDialog',
    title,
  });
  if (title === 'Export Review Packet') {
    return { canceled: false, filePath: exportedPacketPath };
  }
  return { canceled: true };
};
dialog.showMessageBox = async () => ({ response: 0 });

app.setPath('appData', path.join(tempRoot, 'appData'));
app.setPath('userData', path.join(tempRoot, 'userData'));
app.setPath('documents', path.join(tempRoot, 'documents'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer');

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details && typeof details.url === 'string' ? details.url : '';
    const blocked = /^(https?|wss?):/u.test(url);
    if (blocked) networkRequests.push(url);
    callback({ cancel: blocked });
  });
});

process.chdir(rootDir);
if (!process.argv.includes('--dev')) process.argv.push('--dev');
require(path.join(rootDir, 'src', 'main.js'));

async function waitForWindow() {
  return waitUntil(
    () => BrowserWindow.getAllWindows()[0] || null,
    'WINDOW_NOT_CREATED',
    10000,
  );
}

async function waitForLoad(win) {
  if (!win.webContents.isLoadingMainFrame()) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LOAD_TIMEOUT')), 10000);
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timer);
      resolve();
    });
    win.webContents.once('did-fail-load', (_event, _code, description) => {
      clearTimeout(timer);
      reject(new Error('DID_FAIL_LOAD:' + description));
    });
  });
}

function flattenMenuItems(menu) {
  if (!menu || !Array.isArray(menu.items)) return [];
  return menu.items.flatMap((item) => [
    item,
    ...(item.submenu ? flattenMenuItems(item.submenu) : []),
  ]);
}

async function clickNativeMenuItem(item, win) {
  const maybePromise = item.click(item, win, { triggeredByAccelerator: false });
  if (maybePromise && typeof maybePromise.then === 'function') await maybePromise;
}

async function readReviewUiProbe(win) {
  return win.webContents.executeJavaScript(\`(async () => {
    const host = document.querySelector('[data-review-surface-status]');
    const query = await window.electronAPI.invokeWorkspaceQueryBridge({
      queryId: 'query.reviewSurface',
      payload: {},
    });
    const surface = query && query.reviewSurface ? query.reviewSurface : {};
    const preview = surface.exactTextPlanPreview || {};
    return {
      sessionId: surface.revisionSession?.sessionId || '',
      targetId: surface.revisionSession?.reviewGraph?.textChanges?.[0]?.targetScope?.id || '',
      previewStatus: preview.status || '',
      previewReason: preview.reasons?.[0]?.code || preview.reason || '',
      buttonCount: document.querySelectorAll('[data-review-apply-exact-change]').length,
      enabledButtonCount: [...document.querySelectorAll('[data-review-apply-exact-change]')]
        .filter((button) => !button.disabled).length,
      hostStatus: host ? host.getAttribute('data-review-surface-status') : '',
    };
  })()\`, true);
}

app.whenReady().then(async () => {
  try {
    const win = await waitForWindow();
    await waitForLoad(win);

    const projectRoot = path.join(tempRoot, 'documents', 'craftsman', projectName);
    const manifestPath = path.join(projectRoot, 'project.craftsman.json');
    const scenePath = path.join(projectRoot, 'roman', sceneName + '.txt');
    await waitUntil(() => fs.existsSync(manifestPath), 'MANIFEST_NOT_CREATED');
    fs.mkdirSync(path.dirname(scenePath), { recursive: true });
    fs.writeFileSync(scenePath, beforeText, 'utf8');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const baselineHash = crypto.createHash('sha256').update(beforeText, 'utf8').digest('hex');
    const reviewPacket = {
      packetVersion: 'review-packet.v1',
      projectId: manifest.projectId,
      sessionId: 'canonical-ui-e2e-session',
      baselineHash,
      reviewPacket: {
        commentThreads: [],
        commentPlacements: [],
        textChanges: [
          {
            changeId: 'canonical-ui-e2e-change',
            targetScope: { type: 'scene', id: scenePath },
            match: { kind: 'exact', quote: 'beta', prefix: 'Alpha ', suffix: ' gamma.' },
            replacementText: 'delta',
            createdAt: '2026-07-12T00:00:00.000Z',
          },
        ],
        structuralChanges: [],
        diagnosticItems: [],
        decisionStates: [],
      },
      createdAt: '2026-07-12T00:00:00.000Z',
    };
    fs.writeFileSync(packetPath, JSON.stringify(reviewPacket, null, 2) + '\\n', 'utf8');

    const opened = await win.webContents.executeJavaScript(\`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const row = [...document.querySelectorAll('.tree__row')]
          .find((candidate) => (candidate.textContent || '').trim() === ${JSON.stringify('\u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a')});
        if (row) {
          row.click();
          for (let readAttempt = 0; readAttempt < 80; readAttempt += 1) {
            const text = document.querySelector('.ProseMirror')?.innerText || '';
            if (text.includes('Alpha beta gamma.')) return { ok: true, text };
            await sleep(50);
          }
          return { ok: false, reason: 'SCENE_TEXT_NOT_LOADED' };
        }
        await sleep(50);
      }
      return { ok: false, reason: 'SCENE_ROW_NOT_FOUND' };
    })()\`, true);
    if (!opened || opened.ok !== true) {
      throw new Error(opened && opened.reason ? opened.reason : 'SCENE_OPEN_FAILED');
    }

    const applicationMenu = Menu.getApplicationMenu();
    const menuItem = applicationMenu?.getMenuItemById('review-import-local-packet')
      || flattenMenuItems(applicationMenu).find((item) => (
        /import review packet|\\u0438\\u043c\\u043f\\u043e\\u0440\\u0442.*review packet/iu.test(item.label || '')
      ));
    if (!menuItem || typeof menuItem.click !== 'function') {
      const menuLabels = flattenMenuItems(applicationMenu).map((item) => ({ id: item.id, label: item.label }));
      throw new Error('REVIEW_IMPORT_MENU_ITEM_MISSING:' + JSON.stringify(menuLabels));
    }
    const clearMenuItem = applicationMenu?.getMenuItemById('review-clear-session');
    if (!clearMenuItem || typeof clearMenuItem.click !== 'function') {
      throw new Error('REVIEW_CLEAR_MENU_ITEM_MISSING');
    }
    const exportMenuItem = applicationMenu?.getMenuItemById('review-export-local-packet');
    if (!exportMenuItem || typeof exportMenuItem.click !== 'function') {
      throw new Error('REVIEW_EXPORT_MENU_ITEM_MISSING');
    }

    const negativeCases = [];
    const blockedScenarioSpecs = [
      {
        id: 'wrong-project',
        expectedReason: 'REVIEW_EXACT_TEXT_APPLY_PROJECT_MISMATCH',
        mutate(packet) {
          packet.projectId = 'wrong-project-id';
        },
      },
      {
        id: 'wrong-scene',
        expectedReason: 'REVIEW_EXACT_TEXT_APPLY_SCENE_BINDING_MISMATCH',
        mutate(packet) {
          packet.reviewPacket.textChanges[0].targetScope.id = path.join(projectRoot, 'roman', 'missing.txt');
        },
      },
      {
        id: 'stale-baseline',
        expectedReason: 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_STALE_BASELINE',
        mutate(packet) {
          packet.baselineHash = '0'.repeat(64);
        },
      },
      {
        id: 'no-match',
        expectedReason: 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_MATCH',
        mutate(packet) {
          packet.reviewPacket.textChanges[0].match = {
            kind: 'exact',
            quote: 'not present',
            prefix: '',
            suffix: '',
          };
        },
      },
      {
        id: 'duplicate-match',
        expectedReason: 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_DUPLICATE_MATCH',
        mutate(packet) {
          packet.reviewPacket.textChanges[0].match = {
            kind: 'exact',
            quote: 'a',
            prefix: '',
            suffix: '',
          };
        },
      },
    ];

    for (const scenario of blockedScenarioSpecs) {
      const scenarioPacket = JSON.parse(JSON.stringify(reviewPacket));
      scenarioPacket.sessionId = 'canonical-ui-e2e-' + scenario.id;
      scenarioPacket.reviewPacket.textChanges[0].changeId = 'change-' + scenario.id;
      scenario.mutate(scenarioPacket);
      selectedPacketPath = path.join(tempRoot, scenario.id + '.json');
      fs.writeFileSync(selectedPacketPath, JSON.stringify(scenarioPacket, null, 2) + '\\n', 'utf8');
      await clickNativeMenuItem(menuItem, win);
      const probe = await waitUntil(async () => {
        const current = await readReviewUiProbe(win);
        return current.sessionId === scenarioPacket.sessionId && current.previewStatus === 'blocked'
          ? current
          : null;
      }, 'BLOCKED_SCENARIO_NOT_VISIBLE:' + scenario.id);
      negativeCases.push({
        id: scenario.id,
        expectedReason: scenario.expectedReason,
        ...probe,
        diskText: fs.readFileSync(scenePath, 'utf8'),
      });
    }

    await clickNativeMenuItem(clearMenuItem, win);
    await waitUntil(async () => {
      const current = await readReviewUiProbe(win);
      return current.sessionId === '' ? current : null;
    }, 'REVIEW_SESSION_NOT_CLEARED_BEFORE_MALFORMED');
    selectedPacketPath = path.join(tempRoot, 'malformed.json');
    fs.writeFileSync(selectedPacketPath, '{ malformed', 'utf8');
    const malformedResult = await win.webContents.executeJavaScript(\`window.electronAPI.invokeUiCommandBridge({
      route: 'command.bus',
      commandId: 'cmd.project.review.importLocalPacket',
      payload: { requestId: 'canonical-ui-e2e-malformed' },
    })\`, true);
    const malformedProbe = await readReviewUiProbe(win);
    negativeCases.push({
      id: 'malformed-packet',
      expectedReason: 'REVIEW_IMPORT_LOCAL_PACKET_JSON_INVALID',
      commandOk: malformedResult?.ok === true,
      commandReason: malformedResult?.value?.error?.reason || malformedResult?.reason || '',
      ...malformedProbe,
      diskText: fs.readFileSync(scenePath, 'utf8'),
    });

    selectedPacketPath = packetPath;
    await clickNativeMenuItem(menuItem, win);
    await waitUntil(async () => {
      const current = await readReviewUiProbe(win);
      return current.sessionId === reviewPacket.sessionId && current.previewStatus === 'ready'
        ? current
        : null;
    }, 'SEED_PACKET_NOT_READY_FOR_EXPORT');
    await clickNativeMenuItem(exportMenuItem, win);
    await waitUntil(() => fs.existsSync(exportedPacketPath), 'EXPORTED_PACKET_NOT_WRITTEN');
    const exportedPacket = JSON.parse(fs.readFileSync(exportedPacketPath, 'utf8'));
    const exportedPacketSha256 = crypto.createHash('sha256')
      .update(fs.readFileSync(exportedPacketPath))
      .digest('hex');
    const diskAfterExport = fs.readFileSync(scenePath, 'utf8');
    await clickNativeMenuItem(clearMenuItem, win);
    await waitUntil(async () => {
      const current = await readReviewUiProbe(win);
      return current.sessionId === '' ? current : null;
    }, 'REVIEW_SESSION_NOT_CLEARED_BEFORE_EXPORTED_IMPORT');
    selectedPacketPath = exportedPacketPath;
    await clickNativeMenuItem(menuItem, win);

    let lastReadyProbe = null;
    let readyUi = null;
    try {
      readyUi = await waitUntil(async () => {
        lastReadyProbe = await win.webContents.executeJavaScript(\`(async () => {
          const host = document.querySelector('[data-review-surface-status]');
          const button = document.querySelector('[data-review-apply-exact-change]');
          const query = await window.electronAPI.invokeWorkspaceQueryBridge({
            queryId: 'query.reviewSurface',
            payload: {},
          });
          return {
            ready: Boolean(host && button && !button.disabled),
            bodyTail: (document.body?.innerText || '').slice(-1600),
            query,
            buttonCount: document.querySelectorAll('[data-review-apply-exact-change]').length,
            buttonDisabled: button ? button.disabled : null,
            hostStatusObserved: host ? host.getAttribute('data-review-surface-status') : '',
            hostStatus: host ? host.getAttribute('data-review-surface-status') : '',
            buttonText: button ? (button.textContent || '').trim() : '',
            changeId: button ? button.getAttribute('data-change-id') : '',
            disabled: button ? button.disabled : null,
            authorityAttributes: button
              ? [...button.attributes]
                .map((attribute) => attribute.name)
                .filter((name) => /path|project|snapshot|receipt|recovery|apply-ops/u.test(name))
              : [],
          };
        })()\`, true);
        if (!lastReadyProbe || lastReadyProbe.ready !== true) return null;
        return lastReadyProbe;
      }, 'READY_APPLY_BUTTON_NOT_VISIBLE');
    } catch (error) {
      throw new Error((error && error.message ? error.message : String(error))
        + ':' + JSON.stringify(lastReadyProbe));
    }

    const diskBeforeApply = fs.readFileSync(scenePath, 'utf8');
    await win.webContents.executeJavaScript(\`(() => {
      const button = document.querySelector('[data-review-apply-exact-change]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()\`, true);

    await waitUntil(
      () => fs.readFileSync(scenePath, 'utf8') === afterText,
      'SCENE_NOT_APPLIED',
      10000,
    );
    await waitUntil(async () => {
      const editorText = await win.webContents.executeJavaScript(
        \`document.querySelector('.ProseMirror')?.innerText || ''\`,
        true,
      );
      return editorText.includes(afterText) ? editorText : null;
    }, 'EDITOR_NOT_RELOADED_AFTER_APPLY', 10000);
    const query = await win.webContents.executeJavaScript(\`window.electronAPI.invokeWorkspaceQueryBridge({
      queryId: 'query.reviewSurface',
      payload: {},
    })\`, true);
    const receipt = query && query.reviewSurface ? query.reviewSurface.receipt : null;
    const editorAfterApply = await win.webContents.executeJavaScript(
      \`document.querySelector('.ProseMirror')?.innerText || ''\`,
      true,
    );
    const bodyAfterApply = await win.webContents.executeJavaScript(
      \`document.body?.innerText || ''\`,
      true,
    );
    const recoveryPath = receipt && receipt.recovery && typeof receipt.recovery.snapshotPath === 'string'
      ? receipt.recovery.snapshotPath
      : '';
    const recoveryText = recoveryPath && fs.existsSync(recoveryPath)
      ? fs.readFileSync(recoveryPath, 'utf8')
      : '';

    const closedSessionResults = await win.webContents.executeJavaScript(\`(async () => {
      const clearResult = await window.electronAPI.invokeUiCommandBridge({
        route: 'command.bus',
        commandId: 'cmd.project.review.clearSession',
        payload: { requestId: 'canonical-ui-e2e-clear-after-apply' },
      });
      const applyResult = await window.electronAPI.invokeUiCommandBridge({
        route: 'command.bus',
        commandId: 'cmd.project.review.applyExactTextChange',
        payload: {
          requestId: 'canonical-ui-e2e-closed-apply',
          changeId: 'canonical-ui-e2e-change',
        },
      });
      return { clearResult, applyResult };
    })()\`, true);
    negativeCases.push({
      id: 'closed-session',
      expectedReason: 'REVIEW_EXACT_TEXT_APPLY_NO_ACTIVE_SESSION',
      commandOk: closedSessionResults.applyResult?.ok === true,
      commandReason: closedSessionResults.applyResult?.value?.error?.reason
        || closedSessionResults.applyResult?.reason
        || '',
      sessionCleared: closedSessionResults.clearResult?.value?.cleared === true,
      diskText: fs.readFileSync(scenePath, 'utf8'),
    });

    const dirtyBaselineHash = crypto.createHash('sha256').update(afterText, 'utf8').digest('hex');
    const dirtyPacket = JSON.parse(JSON.stringify(reviewPacket));
    dirtyPacket.sessionId = 'canonical-ui-e2e-dirty-editor';
    dirtyPacket.baselineHash = dirtyBaselineHash;
    dirtyPacket.reviewPacket.textChanges[0] = {
      ...dirtyPacket.reviewPacket.textChanges[0],
      changeId: 'change-dirty-editor',
      match: { kind: 'exact', quote: 'delta', prefix: 'Alpha ', suffix: ' gamma.' },
      replacementText: 'epsilon',
    };
    selectedPacketPath = path.join(tempRoot, 'dirty-editor.json');
    fs.writeFileSync(selectedPacketPath, JSON.stringify(dirtyPacket, null, 2) + '\\n', 'utf8');
    const dirtyEditorBeforeImport = await win.webContents.executeJavaScript(\`(async () => {
      const editor = document.querySelector('.ProseMirror');
      if (!editor) return { ok: false, text: '' };
      editor.textContent = (editor.innerText || '') + ' UNSAVED-USER-TEXT';
      const dirtySignal = await window.electronAPI.invokeSaveLifecycleSignalBridge({
        signalId: 'signal.localDirty.set',
        payload: { state: true },
      });
      return { ok: dirtySignal?.ok === true, text: editor.innerText || '' };
    })()\`, true);
    await clickNativeMenuItem(menuItem, win);
    let lastDirtyProbe = null;
    let dirtyProbe = null;
    try {
      dirtyProbe = await waitUntil(async () => {
        lastDirtyProbe = await readReviewUiProbe(win);
        return lastDirtyProbe.sessionId === dirtyPacket.sessionId && lastDirtyProbe.previewStatus === 'blocked'
          ? lastDirtyProbe
          : null;
      }, 'DIRTY_EDITOR_BLOCK_NOT_VISIBLE');
    } catch (error) {
      throw new Error((error && error.message ? error.message : String(error))
        + ':' + JSON.stringify(lastDirtyProbe));
    }
    const dirtyEditorAfterImport = await win.webContents.executeJavaScript(
      \`document.querySelector('.ProseMirror')?.innerText || ''\`,
      true,
    );
    negativeCases.push({
      id: 'dirty-editor',
      expectedReason: 'REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED',
      ...dirtyProbe,
      dirtySignalOk: dirtyEditorBeforeImport.ok === true,
      unsavedTextPreserved: dirtyEditorAfterImport.includes('UNSAVED-USER-TEXT'),
      diskText: fs.readFileSync(scenePath, 'utf8'),
    });

    emit({
      ok: 1,
      menuItemVisible: menuItem.visible !== false,
      readyUi,
      dialogCalls,
      negativeCases,
      exportedPacket: {
        packetVersion: exportedPacket.packetVersion,
        projectId: exportedPacket.projectId,
        sessionId: exportedPacket.sessionId,
        baselineHash: exportedPacket.baselineHash,
        topLevelKeys: Object.keys(exportedPacket).sort(),
        reviewGraphKeys: Object.keys(exportedPacket.reviewPacket || {}).sort(),
        sha256: exportedPacketSha256,
      },
      diskAfterExport,
      diskBeforeApply,
      diskAfterApply: fs.readFileSync(scenePath, 'utf8'),
      editorReloaded: editorAfterApply.includes(afterText),
      receipt: receipt
        ? {
            projectId: receipt.projectId,
            sessionId: receipt.sessionId,
            changeId: receipt.changeId,
            writeStatus: receipt.writeStatus,
            transactionId: receipt.transactionId,
            recovery: receipt.recovery,
          }
        : null,
      receiptVisible: bodyAfterApply.includes('canonical-ui-e2e-change')
        && bodyAfterApply.includes('\\u0441\\u043d\\u0438\\u043c\\u043e\\u043a \\u0441\\u043e\\u0437\\u0434\\u0430\\u043d'),
      recoveryPath,
      recoveryText,
      networkRequests,
    });
    app.exit(0);
  } catch (error) {
    emit({
      ok: 0,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : '',
      dialogCalls,
      networkRequests,
    });
    app.exit(1);
  }
});
`;
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-review-bridge-ui-e2e-'));
const childPath = path.join(tempRoot, 'review-bridge-canonical-ui-e2e-child.cjs');
await fs.writeFile(childPath, createChildSource(tempRoot), 'utf8');

const stdoutChunks = [];
const stderrChunks = [];
const child = spawn(electronBinary, [childPath], {
  cwd: rootDir,
  env: {
    ...process.env,
    ELECTRON_ENABLE_SECURITY_WARNINGS: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

let timedOut = false;
const exitState = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, TIMEOUT_MS);
  child.once('exit', (code, signal) => {
    clearTimeout(timer);
    resolve({ code, signal });
  });
});

const stdout = Buffer.concat(stdoutChunks).toString('utf8');
const stderr = Buffer.concat(stderrChunks).toString('utf8');
const result = parseResult(stdout);

try {
  assert.equal(timedOut, false, `Electron E2E timed out\n${stderr}`);
  assert.equal(exitState.code, 0, `Electron E2E failed\n${stdout}\n${stderr}`);
  assert.equal(result?.ok, 1, result?.message || 'missing Electron E2E result');
  assert.equal(result.menuItemVisible, true);
  assert.equal(result.readyUi.hostStatus, 'ready');
  assert.equal(result.readyUi.buttonText, '\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c');
  assert.equal(result.readyUi.changeId, 'canonical-ui-e2e-change');
  assert.equal(result.readyUi.disabled, false);
  assert.deepEqual(result.readyUi.authorityAttributes, []);
  assert.equal(result.dialogCalls.length, 10);
  assert.equal(
    result.dialogCalls.filter((call) => call.method === 'showOpenDialog' && call.title === 'Import Review Packet').length,
    9,
  );
  assert.equal(
    result.dialogCalls.filter((call) => call.method === 'showSaveDialog' && call.title === 'Export Review Packet').length,
    1,
  );
  assert.equal(result.exportedPacket.packetVersion, 'review-packet.v1');
  assert.equal(result.exportedPacket.sessionId, 'canonical-ui-e2e-session');
  assert.deepEqual(result.exportedPacket.topLevelKeys, [
    'baselineHash',
    'createdAt',
    'packetVersion',
    'projectId',
    'reviewPacket',
    'sessionId',
  ]);
  assert.deepEqual(result.exportedPacket.reviewGraphKeys, [
    'commentPlacements',
    'commentThreads',
    'decisionStates',
    'diagnosticItems',
    'structuralChanges',
    'textChanges',
  ]);
  assert.equal(result.exportedPacket.sha256.length, 64);
  assert.equal(result.diskAfterExport, 'Alpha beta gamma.');
  assert.equal(result.diskBeforeApply, 'Alpha beta gamma.');
  assert.equal(result.diskAfterApply, 'Alpha delta gamma.');
  assert.equal(result.editorReloaded, true);
  assert.equal(result.receipt?.sessionId, 'canonical-ui-e2e-session');
  assert.equal(result.receipt?.changeId, 'canonical-ui-e2e-change');
  assert.equal(result.receipt?.writeStatus, 'applied');
  assert.equal(typeof result.receipt?.transactionId, 'string');
  assert.equal(result.receipt.transactionId.length > 0, true);
  assert.equal(result.receipt?.recovery?.snapshotCreated, true);
  assert.equal(result.receipt?.recovery?.snapshotReadable, true);
  assert.equal(result.receipt?.recovery?.snapshotHashMatchesInput, true);
  assert.equal(result.receiptVisible, true);
  assert.equal(result.recoveryText, 'Alpha beta gamma.');

  const negativeCases = new Map(result.negativeCases.map((item) => [item.id, item]));
  for (const id of ['wrong-project', 'wrong-scene', 'stale-baseline', 'no-match', 'duplicate-match']) {
    const item = negativeCases.get(id);
    assert.equal(item.previewStatus, 'blocked', id);
    assert.equal(item.previewReason, item.expectedReason, `${id}:${JSON.stringify(item)}`);
    assert.equal(item.enabledButtonCount, 0, id);
    assert.equal(item.diskText, 'Alpha beta gamma.', id);
  }
  const malformed = negativeCases.get('malformed-packet');
  assert.equal(malformed.commandOk, false);
  assert.equal(malformed.commandReason, malformed.expectedReason);
  assert.equal(malformed.sessionId, '');
  assert.equal(malformed.enabledButtonCount, 0);
  assert.equal(malformed.diskText, 'Alpha beta gamma.');

  const closedSession = negativeCases.get('closed-session');
  assert.equal(closedSession.sessionCleared, true);
  assert.equal(closedSession.commandOk, false);
  assert.equal(closedSession.commandReason, closedSession.expectedReason);
  assert.equal(closedSession.diskText, 'Alpha delta gamma.');

  const dirtyEditor = negativeCases.get('dirty-editor');
  assert.equal(dirtyEditor.previewStatus, 'blocked');
  assert.equal(dirtyEditor.previewReason, dirtyEditor.expectedReason);
  assert.equal(dirtyEditor.enabledButtonCount, 0);
  assert.equal(dirtyEditor.dirtySignalOk, true);
  assert.equal(dirtyEditor.unsavedTextPreserved, true);
  assert.equal(dirtyEditor.diskText, 'Alpha delta gamma.');
  assert.deepEqual(result.networkRequests, []);
} finally {
  if (!child.killed) child.kill('SIGKILL');
  await fs.rm(tempRoot, { recursive: true, force: true });
}

const afterHash = crypto.createHash('sha256').update(result.diskAfterApply || '', 'utf8').digest('hex');
assert.equal(afterHash.length, 64);
