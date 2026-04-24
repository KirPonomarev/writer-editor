import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_TIMEOUT_MS = 10000;
const PING_CHANNEL = 'electron-runtime-harness:ping';
const PONG_VALUE = 'electron-runtime-harness-pong';

function normalizeTimeoutMs(value) {
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveElectronBinary(rootDir, explicitBinary = '') {
  if (explicitBinary) return explicitBinary;

  const requireFromRoot = createRequire(path.join(rootDir, 'package.json'));
  return requireFromRoot('electron');
}

function createPreloadSource() {
  return `\
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__electronRuntimeHarness', {
  ping(payload) {
    return ipcRenderer.invoke('${PING_CHANNEL}', payload);
  },
});
`;
}

function createChildSource({ preloadPath, userDataPath, token }) {
  return `\
const { app, BrowserWindow, ipcMain, session } = require('electron');

const preloadPath = ${JSON.stringify(preloadPath)};
const userDataPath = ${JSON.stringify(userDataPath)};
const token = ${JSON.stringify(token)};
const channel = ${JSON.stringify(PING_CHANNEL)};
const pong = ${JSON.stringify(PONG_VALUE)};
let networkRequests = 0;

app.setPath('userData', userDataPath);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

ipcMain.handle(channel, async (_event, payload = {}) => ({
  ok: 1,
  pong,
  token: payload && payload.token === token ? token : '',
}));

function emitResult(payload) {
  process.stdout.write('HARNESS_RESULT:' + JSON.stringify(payload) + '\\n');
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details && typeof details.url === 'string' ? details.url : '';
    const shouldBlock = /^(https?|wss?):/u.test(url);
    if (shouldBlock) {
      networkRequests += 1;
    }
    callback({ cancel: shouldBlock });
  });

  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const html = '<!doctype html><meta charset="utf-8"><title>runtime harness</title>'
    + '<script>'
    + 'window.__electronRuntimeHarnessResult = window.__electronRuntimeHarness.ping({ token: ' + JSON.stringify(token) + ' })'
    + '.then((value) => ({ ok: 1, value, preloadPingType: typeof window.__electronRuntimeHarness.ping }))'
    + '.catch((error) => ({ ok: 0, message: error && error.message ? error.message : String(error) }));'
    + '</script>';

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const pingResult = await win.webContents.executeJavaScript('window.__electronRuntimeHarnessResult', true);
  emitResult({
    ok: 1,
    appReady: app.isReady(),
    windowCount: BrowserWindow.getAllWindows().length,
    networkRequests,
    pingResult,
  });
  app.exit(0);
}).catch((error) => {
  emitResult({
    ok: 0,
    message: error && error.message ? error.message : String(error),
  });
  app.exit(1);
});
`;
}

async function writeHarnessFiles(tempRoot, token) {
  const preloadPath = path.join(tempRoot, 'electron-runtime-harness-preload.cjs');
  const childPath = path.join(tempRoot, 'electron-runtime-harness-child.cjs');
  const userDataPath = path.join(tempRoot, 'user-data');

  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(preloadPath, createPreloadSource(), 'utf8');
  await fs.writeFile(childPath, createChildSource({ preloadPath, userDataPath, token }), 'utf8');

  return { childPath, preloadPath, userDataPath };
}

function parseHarnessResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith('HARNESS_RESULT:'));
  if (!line) return null;
  return JSON.parse(line.slice('HARNESS_RESULT:'.length));
}

export async function runElectronRuntimeHarness(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-electron-runtime-harness-'));
  const token = `runtime-harness-${process.pid}-${Date.now()}`;
  let child = null;
  let timedOut = false;

  try {
    const electronBinary = await resolveElectronBinary(rootDir, options.electronBinary || '');
    const { childPath } = await writeHarnessFiles(tempRoot, token);

    const stdoutChunks = [];
    const stderrChunks = [];

    child = spawn(electronBinary, [childPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        ELECTRON_ENABLE_SECURITY_WARNINGS: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    const exitState = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });

    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    const result = parseHarnessResult(stdout);

    return {
      ok: exitState.code === 0 && result && result.ok === 1 && timedOut === false,
      runtimeKind: 'synthetic-electron-runtime',
      timedOut,
      timeoutMs,
      exitCode: exitState.code,
      signal: exitState.signal || '',
      result,
      stdout,
      stderr,
    };
  } finally {
    if (child && !child.killed) {
      child.kill('SIGKILL');
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function runElectronRuntimeHarnessSelfTest(options = {}) {
  const result = await runElectronRuntimeHarness(options);
  const payload = result.result || {};
  const pingResult = payload.pingResult || {};
  const pong = pingResult.value || {};

  return {
    ...result,
    assertions: {
      appReady: payload.appReady === true,
      singleWindow: payload.windowCount === 1,
      noNetwork: payload.networkRequests === 0,
      pingOk: pingResult.ok === 1,
      pongOk: pong.ok === 1 && pong.pong === PONG_VALUE,
      tokenEchoed: typeof pong.token === 'string' && pong.token.startsWith('runtime-harness-'),
      preloadExposed: pingResult.preloadPingType === 'function',
      cleanExit: result.ok === true,
      syntheticRuntime: result.runtimeKind === 'synthetic-electron-runtime',
    },
  };
}
