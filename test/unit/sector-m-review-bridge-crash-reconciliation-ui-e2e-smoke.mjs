import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 30000;
const RESULT_PREFIX = 'REVIEW_BRIDGE_CRASH_RECONCILIATION_UI_E2E_RESULT:';
const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const projectName = 'Роман';
const sceneName = 'черновик';
const operationId = 'op_crash_before_receipt';

function parseResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith(RESULT_PREFIX));
  return line ? JSON.parse(line.slice(RESULT_PREFIX.length)) : null;
}

function createChildSource(tempRoot) {
  return `\
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const tempRoot = ${JSON.stringify(tempRoot)};
const resultPrefix = ${JSON.stringify(RESULT_PREFIX)};
const projectName = ${JSON.stringify(projectName)};
const sceneName = ${JSON.stringify(sceneName)};
const operationId = ${JSON.stringify(operationId)};
const networkRequests = [];

function emit(payload) {
  process.stdout.write(resultPrefix + JSON.stringify(payload) + '\\n');
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
    await waitUntil(() => !win.webContents.isLoadingMainFrame(), 'WINDOW_NOT_LOADED');
    const projectRoot = path.join(tempRoot, 'documents', 'craftsman', projectName);
    const scenePath = path.join(projectRoot, 'roman', sceneName + '.txt');
    const journalPath = path.join(
      projectRoot,
      'backups',
      'revision-bridge-apply-journal',
      operationId + '.json',
    );

    const opened = await win.webContents.executeJavaScript(\`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const row = [...document.querySelectorAll('.tree__row')]
          .find((candidate) => (candidate.textContent || '').trim() === ${JSON.stringify(sceneName)});
        if (row) {
          row.click();
          for (let readAttempt = 0; readAttempt < 80; readAttempt += 1) {
            const text = document.querySelector('.ProseMirror')?.innerText || '';
            if (text.includes('Alpha delta gamma.')) return { ok: true, text };
            await sleep(50);
          }
          return { ok: false, reason: 'SCENE_TEXT_NOT_LOADED' };
        }
        await sleep(50);
      }
      return { ok: false, reason: 'SCENE_ROW_NOT_FOUND' };
    })()\`, true);
    if (!opened || opened.ok !== true) throw new Error(opened?.reason || 'SCENE_OPEN_FAILED');

    const beforeReload = await waitUntil(async () => win.webContents.executeJavaScript(\`(() => {
      const button = document.querySelector('[data-review-reload-reconciled-scene]');
      const queryButton = button && button.dataset.operationId === ${JSON.stringify(operationId)};
      return queryButton ? {
        buttonCount: document.querySelectorAll('[data-review-reload-reconciled-scene]').length,
        operationId: button.dataset.operationId || '',
        bodyText: document.querySelector('[data-review-surface-host]')?.innerText || '',
      } : null;
    })()\`, true), 'RECONCILIATION_ACTION_NOT_VISIBLE');

    const queryBefore = await win.webContents.executeJavaScript(\`window.electronAPI.invokeWorkspaceQueryBridge({
      queryId: 'query.reviewSurface',
      payload: {},
    })\`, true);
    const clicked = await win.webContents.executeJavaScript(\`(() => {
      const button = document.querySelector('[data-review-reload-reconciled-scene]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()\`, true);
    if (!clicked) throw new Error('RECONCILIATION_ACTION_NOT_CLICKED');
    await waitUntil(
      () => win.webContents.executeJavaScript(
        \`document.querySelectorAll('[data-review-reload-reconciled-scene]').length === 0\`,
        true,
      ),
      'RECONCILIATION_ACTION_NOT_ACKNOWLEDGED',
    );

    const editorText = await win.webContents.executeJavaScript(
      \`document.querySelector('.ProseMirror')?.innerText || ''\`,
      true,
    );
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    emit({
      ok: 1,
      beforeReload,
      startupOutcome: queryBefore?.reviewSurface?.exactTextApplyReconciliation?.items?.[0]?.outcome || '',
      startupSafeActions: queryBefore?.reviewSurface?.exactTextApplyReconciliation?.items?.[0]?.safeActions || [],
      editorText,
      diskText: fs.readFileSync(scenePath, 'utf8'),
      journalStatus: journal.status,
      acknowledgedAction: journal.reconciliation?.acknowledgedAction || '',
      networkRequests,
    });
    app.exit(0);
  } catch (error) {
    emit({
      ok: 0,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : '',
      networkRequests,
    });
    app.exit(1);
  }
});
`;
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-review-crash-ui-e2e-'));
for (const name of ['appData', 'userData', 'documents']) {
  await fs.mkdir(path.join(tempRoot, name), { recursive: true });
}
const projectRoot = path.join(tempRoot, 'documents', 'craftsman', projectName);
const sceneRelativePath = `roman/${sceneName}.txt`;
const scenePath = path.join(projectRoot, ...sceneRelativePath.split('/'));
await fs.mkdir(path.dirname(scenePath), { recursive: true });
await fs.mkdir(path.join(projectRoot, 'backups'), { recursive: true });
await fs.writeFile(scenePath, 'Alpha beta gamma.', 'utf8');
await fs.writeFile(path.join(projectRoot, 'project.craftsman.json'), `${JSON.stringify({
  schemaVersion: 1,
  projectId: 'project-crash-ui-e2e',
  projectName,
  createdAtUtc: '2026-07-12T00:00:00.000Z',
}, null, 2)}\n`, 'utf8');

const crashFixture = path.join(
  rootDir,
  'test/fixtures/revision-bridge-exact-text-apply-crash-child.mjs',
);
const crashed = spawnSync(process.execPath, [
  crashFixture,
  projectRoot,
  'before_receipt',
  sceneRelativePath,
], {
  cwd: rootDir,
  encoding: 'utf8',
});
assert.equal(crashed.status, 73, crashed.stderr || 'crash fixture did not reach before_receipt');
assert.equal(fsSync.readFileSync(scenePath, 'utf8'), 'Alpha delta gamma.');

const childPath = path.join(tempRoot, 'review-crash-reconciliation-ui-e2e-child.cjs');
await fs.writeFile(childPath, createChildSource(tempRoot), 'utf8');
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

assert.equal(timedOut, false, `Electron reconciliation E2E timed out\n${stderr}`);
assert.equal(exitState.code, 0, `Electron reconciliation E2E failed\n${stdout}\n${stderr}`);
assert.equal(result?.ok, 1, result?.message || 'missing Electron reconciliation result');
assert.equal(result.beforeReload.buttonCount, 1);
assert.equal(result.beforeReload.operationId, operationId);
assert.equal(result.beforeReload.bodyText.includes('Запись применена без отчета'), true);
assert.equal(result.startupOutcome, 'applied_receipt_missing');
assert.deepEqual(result.startupSafeActions, ['RELOAD_CANONICAL']);
assert.equal(result.editorText.includes('Alpha delta gamma.'), true);
assert.equal(result.diskText, 'Alpha delta gamma.');
assert.equal(result.journalStatus, 'reconciled');
assert.equal(result.acknowledgedAction, 'RELOAD_CANONICAL');
assert.deepEqual(result.networkRequests, []);
