#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ARTIFACT_ID = 'EDITORIAL_SHEET_SCROLL_STROBE_VISUAL_STATUS_V1';
export const SCHEMA_VERSION = 1;
export const TASK_ID = 'CONTOUR_10_SCROLL_STROBE_VISUAL_PROOF_AND_FALSE_GREEN_GUARD';
export const STATUS_BASENAME = 'EDITORIAL_SHEET_SCROLL_STROBE_VISUAL_STATUS_V1.json';
export const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
export const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RESULT_PREFIX = 'EDITORIAL_SHEET_SCROLL_STROBE_VISUAL_RESULT:';
export const SUMMARY_PREFIX = 'EDITORIAL_SHEET_SCROLL_STROBE_VISUAL_SUMMARY:';
export const TARGET_SCENARIO = 'vertical-sheet-100-scroll-0.82';

const requireFromHere = createRequire(import.meta.url);
const TIMEOUT_MS = 120000;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSort(entry));
  if (!value || typeof value !== 'object' || value.constructor !== Object) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableJson(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

function readJsonObject(targetPath) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    write: false,
    statusPath: '',
    outputDir: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = normalizeString(argv[index]);
    if (arg === '--json') out.json = true;
    else if (arg === '--write') out.write = true;
    else if (arg === '--status-path' && argv[index + 1]) {
      out.statusPath = normalizeString(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length));
    } else if (arg === '--output-dir' && argv[index + 1]) {
      out.outputDir = normalizeString(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length));
    }
  }
  return out;
}

function resolveStatusPath(repoRoot, statusPathArg) {
  if (statusPathArg) return path.isAbsolute(statusPathArg) ? statusPathArg : path.resolve(repoRoot, statusPathArg);
  return path.join(repoRoot, STATUS_REL_PATH);
}

function getGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? normalizeString(result.stdout) : '';
}

function resolveElectronBinary(repoRoot) {
  const candidates = [
    process.env.EDITORIAL_SHEET_NODE_MODULES_ROOT
      ? path.join(process.env.EDITORIAL_SHEET_NODE_MODULES_ROOT, 'electron')
      : '',
    path.join(repoRoot, 'node_modules', 'electron'),
    'electron',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (candidate === 'electron') return requireFromHere('electron');
      const packageJson = path.join(candidate, 'package.json');
      if (fs.existsSync(packageJson)) {
        return createRequire(packageJson)('electron');
      }
    } catch {
      // Try the next candidate.
    }
  }
  return requireFromHere('electron');
}

function createHelperSource({ repoRoot, outputDir }) {
  return `\
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, dialog, session } = require('electron');

const repoRoot = ${JSON.stringify(repoRoot)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(repoRoot, 'src', 'main.js');
const resultPath = path.join(outputDir, 'scroll-strobe-result.json');
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLongText(unitCount) {
  const sentence = 'Scroll strobe proof sentence that must remain visible during derived sheet window transitions.';
  return Array.from({ length: unitCount }, (_, index) => sentence + ' ' + String(index + 1) + '.').join(' ');
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function analyzeBitmap(image) {
  const size = image.getSize();
  const bitmap = image.toBitmap();
  let nonWhitePixels = 0;
  for (let index = 0; index + 3 < bitmap.length; index += 4) {
    const blue = bitmap[index];
    const green = bitmap[index + 1];
    const red = bitmap[index + 2];
    const alpha = bitmap[index + 3];
    if (alpha > 8 && (red < 245 || green < 245 || blue < 245)) nonWhitePixels += 1;
  }
  const pixelCount = Math.max(1, size.width * size.height);
  return {
    width: size.width,
    height: size.height,
    nonWhitePixelCount: nonWhitePixels,
    nonWhiteRatio: nonWhitePixels / pixelCount,
    blank: nonWhitePixels < Math.max(64, Math.floor(pixelCount * 0.0005)),
  };
}

async function waitForWindow() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) return win;
    await sleep(100);
  }
  throw new Error('WINDOW_NOT_CREATED');
}

async function waitForLoad(win) {
  if (!win.webContents.isLoadingMainFrame()) return;
  await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
}

async function setEditorContent(win) {
  win.webContents.send('editor:set-text', {
    content: buildLongText(2200),
    title: 'scroll-strobe-visual-proof',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'scroll-strobe-visual-proof',
    bookProfile: null,
  });
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const canvas = document.querySelector('.main-content--editor');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const toPlainRect = (rect) => rect ? ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    }) : null;
    const intersects = (a, b) => (
      a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
    );
    const canvasRect = canvas ? toPlainRect(canvas.getBoundingClientRect()) : null;
    const pageRects = pageWraps.map((el) => toPlainRect(el.getBoundingClientRect())).filter(Boolean);
    const walker = prose
      ? document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.textContent && node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        })
      : null;
    const textRects = [];
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        const range = document.createRange();
        range.selectNodeContents(current);
        [...range.getClientRects()].forEach((rect) => textRects.push(toPlainRect(rect)));
        current = walker.nextNode();
      }
    }
    const visibleViewportSheetCount = canvasRect
      ? pageRects.filter((pageRect) => pageRect && intersects(pageRect, canvasRect)).length
      : 0;
    const visibleViewportTextRectCount = canvasRect
      ? textRects.filter((textRect) => textRect && intersects(textRect, canvasRect)).length
      : 0;
    const sourcePageCount = Number(
      (host && host.dataset.centralSheetBoundedOverflowSourcePageCount)
      || (host && host.dataset.centralSheetCount)
      || pageWraps.length
      || 0
    );
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      firstRenderedPage: Number(host ? host.dataset.centralSheetWindowFirstRenderedPage || 0 : 0),
      lastRenderedPage: Number(host ? host.dataset.centralSheetWindowLastRenderedPage || 0 : 0),
      sourcePageCount,
      visibleSheetCount: pageWraps.length,
      visibleViewportSheetCount,
      visibleViewportTextRectCount,
      scrollTop: canvas instanceof HTMLElement ? canvas.scrollTop : 0,
      canvasRect,
      viewportWidth: canvasRect ? Math.round(canvasRect.width) : 0,
      viewportHeight: canvasRect ? Math.round(canvasRect.height) : 0,
      domNodeCount: document.querySelectorAll('*').length,
      textRectCount: textRects.length,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
    };
  })()\`, true);
}

async function captureViewport(win, basename, state) {
  if (!state || !state.canvasRect) throw new Error('CANVAS_RECT_MISSING_' + basename);
  const rect = {
    x: Math.max(0, Math.floor(state.canvasRect.x)),
    y: Math.max(0, Math.floor(state.canvasRect.y)),
    width: Math.max(1, Math.floor(state.canvasRect.width)),
    height: Math.max(1, Math.floor(state.canvasRect.height)),
  };
  const image = await win.capturePage(rect);
  const png = image.toPNG();
  const targetPath = path.join(outputDir, basename);
  await fs.writeFile(targetPath, png);
  return {
    basename,
    sha256: sha256Buffer(png),
    ...analyzeBitmap(image),
  };
}

async function scrollEditorViewport(win, ratio) {
  return win.webContents.executeJavaScript(\`(() => {
    const canvas = document.querySelector('.main-content--editor');
    if (!(canvas instanceof HTMLElement)) return { ok: false, reason: 'EDITOR_CANVAS_MISSING' };
    const maxScrollTop = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
    canvas.scrollTop = Math.round(maxScrollTop * \${JSON.stringify(ratio)});
    return {
      ok: true,
      ratio: \${JSON.stringify(ratio)},
      scrollTop: canvas.scrollTop,
      maxScrollTop,
      clientHeight: canvas.clientHeight,
      scrollHeight: canvas.scrollHeight,
    };
  })()\`, true);
}

async function waitForScenario(win) {
  let lastState = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(250);
    const state = await collectState(win, 'stable');
    lastState = state;
    if (
      state.centralSheetFlow === 'vertical'
      && state.sourcePageCount >= 100
      && state.visibleSheetCount > 0
      && state.proseMirrorCount === 1
    ) return state;
  }
  throw new Error('SCENARIO_NOT_STABLE_' + JSON.stringify(lastState));
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.setPath('userData', path.join(outputDir, 'user-data'));

for (const method of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  dialog[method] = async () => {
    dialogCalls += 1;
    return { canceled: true };
  };
}

process.chdir(repoRoot);
if (!process.argv.includes('--dev')) process.argv.push('--dev');
require(mainEntrypoint);

app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^(https?|wss?):/u.test(String(details.url || ''))) networkRequests += 1;
      callback({ cancel: false });
    });
    await fs.mkdir(outputDir, { recursive: true });
    const win = await waitForWindow();
    await waitForLoad(win);
    win.setContentSize(3840, 1110);
    await sleep(1200);
    await setEditorContent(win);
    const stable = await waitForScenario(win);
    const before = await collectState(win, 'before-scroll');
    const beforeScreenshot = await captureViewport(win, 'scroll-strobe-before.png', before);
    const scrollResult = await scrollEditorViewport(win, 0.82);
    const immediate = await collectState(win, 'after-scroll-immediate');
    const immediateScreenshot = await captureViewport(win, 'scroll-strobe-immediate.png', immediate);
    await sleep(96);
    const settled = await collectState(win, 'after-scroll-settled');
    const settledScreenshot = await captureViewport(win, 'scroll-strobe-settled.png', settled);
    const payload = {
      ok: true,
      outputDir,
      stable,
      before,
      beforeScreenshot,
      scrollResult,
      immediate,
      immediateScreenshot,
      settled,
      settledScreenshot,
      networkRequests,
      dialogCalls,
    };
    await fs.writeFile(resultPath, JSON.stringify(payload, null, 2));
    process.stdout.write(${JSON.stringify(RESULT_PREFIX)} + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = {
      ok: false,
      error: error && error.stack ? error.stack : String(error),
      networkRequests,
      dialogCalls,
      outputDir,
    };
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(resultPath, JSON.stringify(payload, null, 2));
    process.stdout.write(${JSON.stringify(RESULT_PREFIX)} + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

function parseResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith(RESULT_PREFIX));
  if (!line) return null;
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

function classify(result) {
  const immediate = result?.immediate || {};
  const settled = result?.settled || {};
  const immediateScreenshot = result?.immediateScreenshot || {};
  const settledScreenshot = result?.settledScreenshot || {};
  const missing = [
    immediate.visibleViewportSheetCount,
    immediate.visibleViewportTextRectCount,
    settled.visibleViewportSheetCount,
    settled.visibleViewportTextRectCount,
    immediateScreenshot.blank,
    settledScreenshot.blank,
  ].some((value) => value === undefined || value === null);
  if (missing) return 'STOP';
  if (settledScreenshot.blank === true || Number(settled.visibleViewportTextRectCount || 0) <= 0) {
    return 'STROBE_REPRODUCED_RED';
  }
  if (immediateScreenshot.blank === true || Number(immediate.visibleViewportTextRectCount || 0) <= 0) {
    return 'STROBE_REPRODUCED_RED';
  }
  if (Number(immediate.visibleViewportSheetCount || 0) === 0) {
    return 'TRANSIENT_INSTRUMENTATION_ZERO';
  }
  return 'NONBLANK_PROVED';
}

function buildArtifact(result, repoRoot) {
  const classification = classify(result);
  const ok = classification === 'NONBLANK_PROVED' || classification === 'TRANSIENT_INSTRUMENTATION_ZERO';
  const immediate = result?.immediate || {};
  const settled = result?.settled || {};
  const immediateScreenshot = result?.immediateScreenshot || {};
  const settledScreenshot = result?.settledScreenshot || {};
  return stableSort({
    artifactId: ARTIFACT_ID,
    classification,
    dialogCalls: Number(result?.dialogCalls || 0),
    generatedAtUtc: new Date().toISOString(),
    immediateScreenshotBasename: normalizeString(immediateScreenshot.basename),
    immediateScreenshotBlank: Boolean(immediateScreenshot.blank),
    immediateScreenshotSha256: normalizeString(immediateScreenshot.sha256),
    immediateSheetCount: Number(immediate.visibleViewportSheetCount || 0),
    immediateTextRectCount: Number(immediate.visibleViewportTextRectCount || 0),
    networkRequests: Number(result?.networkRequests || 0),
    notes: [
      'screenshots are temporary support evidence only',
      'status artifact records basenames and hashes, not image payloads',
      '6000 remains diagnostic-only and is not promoted by this artifact',
    ],
    ok,
    repoHeadSha: getGitHead(repoRoot),
    schemaVersion: SCHEMA_VERSION,
    screenshotPrimaryProof: false,
    settledScreenshotBasename: normalizeString(settledScreenshot.basename),
    settledScreenshotBlank: Boolean(settledScreenshot.blank),
    settledScreenshotSha256: normalizeString(settledScreenshot.sha256),
    settledSheetCount: Number(settled.visibleViewportSheetCount || 0),
    settledTextRectCount: Number(settled.visibleViewportTextRectCount || 0),
    status: ok ? 'PASS' : 'FAIL',
    strobeReproduced: classification === 'STROBE_REPRODUCED_RED',
    targetScenario: TARGET_SCENARIO,
    taskId: TASK_ID,
    viewportHeight: Number(immediate.viewportHeight || settled.viewportHeight || 0),
    viewportWidth: Number(immediate.viewportWidth || settled.viewportWidth || 0),
    visualNonblankProved: ok,
  });
}

async function writeJsonAtomic(targetPath, value) {
  const tmpPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(tmpPath, stableJson(value), 'utf8');
  await fsp.rename(tmpPath, targetPath);
}

export function validateScrollStrobeVisualStatus(artifact) {
  const issues = [];
  const requiredFields = [
    'artifactId',
    'schemaVersion',
    'taskId',
    'generatedAtUtc',
    'repoHeadSha',
    'status',
    'ok',
    'targetScenario',
    'viewportWidth',
    'viewportHeight',
    'immediateSheetCount',
    'immediateTextRectCount',
    'immediateScreenshotBlank',
    'immediateScreenshotBasename',
    'immediateScreenshotSha256',
    'settledSheetCount',
    'settledTextRectCount',
    'settledScreenshotBlank',
    'settledScreenshotBasename',
    'settledScreenshotSha256',
    'screenshotPrimaryProof',
    'visualNonblankProved',
    'strobeReproduced',
    'classification',
    'networkRequests',
    'dialogCalls',
    'notes',
  ];
  for (const field of requiredFields) {
    if (!(field in Object(artifact))) issues.push(`FIELD_MISSING_${field}`);
  }
  if (artifact?.artifactId !== ARTIFACT_ID) issues.push('ARTIFACT_ID_INVALID');
  if (Number(artifact?.schemaVersion || 0) !== SCHEMA_VERSION) issues.push('SCHEMA_VERSION_INVALID');
  if (artifact?.taskId !== TASK_ID) issues.push('TASK_ID_INVALID');
  if (artifact?.targetScenario !== TARGET_SCENARIO) issues.push('TARGET_SCENARIO_INVALID');
  if (artifact?.screenshotPrimaryProof !== false) issues.push('SCREENSHOT_PRIMARY_PROOF_NOT_FALSE');
  if (Number(artifact?.networkRequests || 0) !== 0) issues.push('NETWORK_REQUESTS_NOT_ZERO');
  if (Number(artifact?.dialogCalls || 0) !== 0) issues.push('DIALOG_CALLS_NOT_ZERO');
  if (!/^[0-9a-f]{64}$/u.test(normalizeString(artifact?.immediateScreenshotSha256))) issues.push('IMMEDIATE_SCREENSHOT_SHA_INVALID');
  if (!/^[0-9a-f]{64}$/u.test(normalizeString(artifact?.settledScreenshotSha256))) issues.push('SETTLED_SCREENSHOT_SHA_INVALID');
  if (artifact?.classification === 'NONBLANK_PROVED') {
    if (Number(artifact?.immediateSheetCount || 0) <= 0) issues.push('NONBLANK_IMMEDIATE_SHEET_COUNT_NOT_POSITIVE');
  }
  if (artifact?.classification === 'NONBLANK_PROVED' || artifact?.classification === 'TRANSIENT_INSTRUMENTATION_ZERO') {
    if (artifact?.immediateScreenshotBlank !== false) issues.push('GREEN_IMMEDIATE_SCREENSHOT_BLANK');
    if (Number(artifact?.immediateTextRectCount || 0) <= 0) issues.push('GREEN_IMMEDIATE_TEXT_RECT_MISSING');
    if (artifact?.settledScreenshotBlank !== false) issues.push('GREEN_SETTLED_SCREENSHOT_BLANK');
    if (Number(artifact?.settledTextRectCount || 0) <= 0) issues.push('GREEN_SETTLED_TEXT_RECT_MISSING');
    if (artifact?.ok !== true) issues.push('GREEN_OK_NOT_TRUE');
    if (artifact?.status !== 'PASS') issues.push('GREEN_STATUS_NOT_PASS');
    if (artifact?.visualNonblankProved !== true) issues.push('GREEN_VISUAL_NONBLANK_NOT_TRUE');
    if (artifact?.strobeReproduced !== false) issues.push('GREEN_STROBE_REPRODUCED_NOT_FALSE');
  }
  if (artifact?.classification === 'STROBE_REPRODUCED_RED') {
    if (artifact?.ok !== false) issues.push('RED_OK_NOT_FALSE');
    if (artifact?.status !== 'FAIL') issues.push('RED_STATUS_NOT_FAIL');
  }
  if (!['NONBLANK_PROVED', 'TRANSIENT_INSTRUMENTATION_ZERO', 'STROBE_REPRODUCED_RED', 'STOP'].includes(artifact?.classification)) {
    issues.push('CLASSIFICATION_INVALID');
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

async function runProbe({ repoRoot, outputDir }) {
  const resolvedOutputDir = outputDir || await fsp.mkdtemp(path.join(os.tmpdir(), 'editorial-sheet-scroll-strobe-'));
  await fsp.mkdir(resolvedOutputDir, { recursive: true });
  const helperPath = path.join(resolvedOutputDir, 'scroll-strobe-helper.cjs');
  await fsp.writeFile(helperPath, createHelperSource({ repoRoot, outputDir: resolvedOutputDir }), 'utf8');
  const electronBinary = resolveElectronBinary(repoRoot);
  const child = spawn(electronBinary, [helperPath], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_ENABLE_SECURITY_WARNINGS: 'false',
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const exitCode = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(124);
    }, TIMEOUT_MS);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(typeof code === 'number' ? code : 1);
    });
  });
  const parsed = parseResult(stdout);
  const result = parsed || readJsonObject(path.join(resolvedOutputDir, 'scroll-strobe-result.json')) || {
    ok: false,
    error: 'RESULT_MISSING',
  };
  if (exitCode !== 0 || result.ok !== true) {
    result.ok = false;
    result.exitCode = exitCode;
    result.stderrTail = stderr.slice(-4000);
    result.stdoutTail = stdout.slice(-4000);
  }
  return result;
}

async function main() {
  const args = parseArgs();
  const repoRoot = DEFAULT_REPO_ROOT;
  const statusPath = resolveStatusPath(repoRoot, args.statusPath);
  if (args.write) {
    const result = await runProbe({ repoRoot, outputDir: args.outputDir });
    const artifact = buildArtifact(result, repoRoot);
    await writeJsonAtomic(statusPath, artifact);
    const validation = validateScrollStrobeVisualStatus(artifact);
    const payload = {
      artifact,
      ok: validation.ok,
      outputDir: result.outputDir || '',
      statusPath,
      validation,
      wroteArtifact: true,
    };
    if (args.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else {
      process.stdout.write(`${SUMMARY_PREFIX}${JSON.stringify({
        ok: validation.ok,
        classification: artifact.classification,
        immediateSheetCount: artifact.immediateSheetCount,
        immediateTextRectCount: artifact.immediateTextRectCount,
        settledSheetCount: artifact.settledSheetCount,
        settledTextRectCount: artifact.settledTextRectCount,
      })}\n`);
    }
    process.exit(validation.ok ? 0 : 1);
  }
  const artifact = readJsonObject(statusPath);
  const validation = validateScrollStrobeVisualStatus(artifact);
  const payload = {
    artifact,
    ok: validation.ok,
    statusPath,
    validation,
    wroteArtifact: false,
  };
  if (args.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else process.stdout.write(`${validation.ok ? 'PASS' : 'FAIL'}\n`);
  process.exit(validation.ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
