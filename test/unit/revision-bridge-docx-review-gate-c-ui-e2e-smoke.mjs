import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 30000;
const RESULT_PREFIX = 'REVIEW_BRIDGE_DOCX_GATE_C_UI_E2E_RESULT:';
const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = path.join(rootDir, 'test', 'fixtures', 'revision-bridge', 'v1', 'docx-review-evidence-v1.docx');
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');

function parseResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith(RESULT_PREFIX));
  return line ? JSON.parse(line.slice(RESULT_PREFIX.length)) : null;
}

function createChildSource(tempRoot, selectedDocxPath) {
  return `\
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, Menu, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const fixturePath = ${JSON.stringify(selectedDocxPath)};
const tempRoot = ${JSON.stringify(tempRoot)};
const RESULT_PREFIX = ${JSON.stringify(RESULT_PREFIX)};
const beforeText = 'Alpha beta gamma.';
const networkRequests = [];
const dialogCalls = [];
let lastProbe = null;

function emit(payload) {
  process.stdout.write(RESULT_PREFIX + JSON.stringify(payload) + '\\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshotProjectFiles(rootPath) {
  const files = [];
  const visit = (currentPath) => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push({
        relativePath: path.relative(rootPath, entryPath),
        sha256: crypto.createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex'),
      });
    }
  };
  visit(rootPath);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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
  if (title === 'Open DOCX Review') return { canceled: false, filePaths: [fixturePath] };
  return { canceled: true, filePaths: [] };
};
dialog.showSaveDialog = async () => ({ canceled: true });
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

app.whenReady().then(async () => {
  try {
    const win = await waitUntil(() => BrowserWindow.getAllWindows()[0] || null, 'WINDOW_NOT_CREATED');
    if (win.webContents.isLoadingMainFrame()) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('LOAD_TIMEOUT')), 10000);
        win.webContents.once('did-finish-load', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    const projectRoot = path.join(tempRoot, 'documents', 'craftsman', '\\u0420\\u043e\\u043c\\u0430\\u043d');
    const manifestPath = path.join(projectRoot, 'project.craftsman.json');
    const scenePath = path.join(projectRoot, 'roman', '\\u0447\\u0435\\u0440\\u043d\\u043e\\u0432\\u0438\\u043a.txt');
    await waitUntil(() => fs.existsSync(manifestPath), 'MANIFEST_NOT_CREATED');
    fs.mkdirSync(path.dirname(scenePath), { recursive: true });
    fs.writeFileSync(scenePath, beforeText, 'utf8');

    const opened = await win.webContents.executeJavaScript(\`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const findScene = (node) => {
        if (!node || typeof node !== 'object') return null;
        if (
          typeof node.path === 'string'
          && node.path.endsWith('.txt')
          && (node.name === '\\u0447\\u0435\\u0440\\u043d\\u043e\\u0432\\u0438\\u043a' || node.label === '\\u0447\\u0435\\u0440\\u043d\\u043e\\u0432\\u0438\\u043a')
        ) return node;
        for (const child of Array.isArray(node.children) ? node.children : []) {
          const found = findScene(child);
          if (found) return found;
        }
        return null;
      };
      const tree = await window.electronAPI.invokeWorkspaceQueryBridge({
        queryId: 'query.projectTree',
        payload: { tab: 'roman' },
      });
      const scene = findScene(tree?.root);
      if (!scene) return { ok: false, reason: 'SCENE_NODE_NOT_FOUND', tree };
      const openResult = await window.electronAPI.invokeUiCommandBridge({
        route: 'command.bus',
        commandId: 'cmd.project.document.open',
        payload: {
          path: scene.path,
          title: scene.label || scene.name,
          kind: scene.kind,
        },
      });
      if (!openResult || openResult.ok !== true) return { ok: false, reason: 'SCENE_OPEN_COMMAND_FAILED', openResult };
      for (let readAttempt = 0; readAttempt < 80; readAttempt += 1) {
        const text = document.querySelector('.ProseMirror')?.innerText || '';
        if (text.includes('Alpha beta gamma.')) return { ok: true, sceneKind: scene.kind, scenePath: scene.path };
        await sleep(50);
      }
      return { ok: false, reason: 'SCENE_TEXT_NOT_LOADED', sceneKind: scene.kind, scenePath: scene.path };
    })()\`, true);
    if (!opened || opened.ok !== true) throw new Error(opened?.reason || 'SCENE_OPEN_FAILED');
    const projectFilesBeforeCommand = snapshotProjectFiles(projectRoot);

    const menuItem = Menu.getApplicationMenu()?.getMenuItemById('review-open-docx-review-preview-session');
    if (!menuItem || typeof menuItem.click !== 'function') throw new Error('DOCX_REVIEW_MENU_ITEM_MISSING');
    const commandResult = await win.webContents.executeJavaScript(\`window.electronAPI.invokeUiCommandBridge({
      route: 'command.bus',
      commandId: 'cmd.project.review.openDocxReviewPreviewSession',
      payload: { requestId: 'docx-gate-c-ui-e2e' },
    })\`, true);
    if (!commandResult || commandResult.ok !== true || commandResult.value?.ok !== true) {
      throw new Error('DOCX_REVIEW_COMMAND_FAILED:' + JSON.stringify({ opened, commandResult }));
    }

    const probe = await waitUntil(async () => {
      const value = await win.webContents.executeJavaScript(\`(async () => {
        const query = await window.electronAPI.invokeWorkspaceQueryBridge({
          queryId: 'query.reviewSurface',
          payload: {},
        });
        const surface = query?.reviewSurface || {};
        const graph = surface.revisionSession?.reviewGraph || {};
        const candidate = graph.textChanges?.[0] || null;
        return {
          sessionId: surface.revisionSession?.sessionId || '',
          textChangeCount: graph.textChanges?.length || 0,
          structuralChangeCount: graph.structuralChanges?.length || 0,
          commentThreadCount: graph.commentThreads?.length || 0,
          matchKind: candidate?.match?.kind || '',
          quote: candidate?.match?.quote || '',
          replacementText: candidate?.replacementText || '',
          planStatus: surface.exactTextPlanPreview?.status || '',
          applyOpCount: surface.exactTextPlanPreview?.plan?.applyOps?.length || 0,
          buttonCount: document.querySelectorAll('[data-review-apply-exact-change]').length,
          enabledButtonCount: [...document.querySelectorAll('[data-review-apply-exact-change]')]
            .filter((button) => !button.disabled).length,
          bodyText: document.body?.innerText || '',
          receipt: surface.receipt || null,
        };
      })()\`, true);
      lastProbe = value;
      return value.textChangeCount === 1 && value.bodyText.includes('beta') && value.bodyText.includes('delta')
        ? value
        : null;
    }, 'DOCX_TRACKED_TEXT_CANDIDATE_NOT_VISIBLE');

    const image = await win.webContents.capturePage();
    const bitmap = image.toBitmap();
    const sampled = new Set();
    for (let index = 0; index < bitmap.length; index += Math.max(4, Math.floor(bitmap.length / 4096))) {
      sampled.add(bitmap[index]);
    }
    emit({
      ok: 1,
      menuVisible: menuItem.visible !== false,
      commandActivated: commandResult.value.activated === true,
      probe,
      diskText: fs.readFileSync(scenePath, 'utf8'),
      projectFilesBeforeCommand,
      projectFilesAfterCommand: snapshotProjectFiles(projectRoot),
      dialogCalls,
      networkRequests,
      screenshotBytes: image.toPNG().byteLength,
      sampledPixelValues: sampled.size,
    });
    app.exit(0);
  } catch (error) {
    emit({
      ok: 0,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : '',
      lastProbe,
      dialogCalls,
      networkRequests,
    });
    app.exit(1);
  }
});
`;
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-docx-gate-c-ui-e2e-'));
const selectedDocxPath = path.join(tempRoot, 'selected-docx-review.docx');
await fs.copyFile(fixturePath, selectedDocxPath);
const childPath = path.join(tempRoot, 'docx-gate-c-ui-e2e-child.cjs');
await fs.writeFile(childPath, createChildSource(tempRoot, selectedDocxPath), 'utf8');

const stdoutChunks = [];
const stderrChunks = [];
const child = spawn(electronBinary, [childPath], {
  cwd: rootDir,
  env: { ...process.env, ELECTRON_ENABLE_SECURITY_WARNINGS: 'false' },
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
  assert.equal(timedOut, false, `Electron Gate C E2E timed out\n${stderr}`);
  assert.equal(exitState.code, 0, `Electron Gate C E2E failed\n${stdout}\n${stderr}`);
  assert.equal(result?.ok, 1, result?.message || 'missing Electron Gate C E2E result');
  assert.equal(result.menuVisible, true);
  assert.equal(result.commandActivated, true);
  assert.deepEqual(result.dialogCalls, [{ method: 'showOpenDialog', title: 'Open DOCX Review' }]);
  assert.equal(result.probe.textChangeCount, 1);
  assert.equal(result.probe.structuralChangeCount, 0);
  assert.equal(result.probe.commentThreadCount, 1);
  assert.equal(result.probe.matchKind, 'manual');
  assert.equal(result.probe.quote, 'beta');
  assert.equal(result.probe.replacementText, 'delta');
  assert.equal(result.probe.planStatus, 'blocked');
  assert.equal(result.probe.applyOpCount, 0);
  assert.equal(result.probe.buttonCount, 0);
  assert.equal(result.probe.enabledButtonCount, 0);
  assert.equal(result.probe.receipt, null);
  assert.equal(result.diskText, 'Alpha beta gamma.');
  assert.deepEqual(result.projectFilesAfterCommand, result.projectFilesBeforeCommand);
  assert.equal(result.screenshotBytes > 1000, true);
  assert.equal(result.sampledPixelValues > 1, true);
  assert.deepEqual(result.networkRequests, []);
} finally {
  if (!child.killed) child.kill('SIGKILL');
  await fs.rm(tempRoot, { recursive: true, force: true });
}
