const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { app, BrowserWindow } = require('electron');

const cleanRoot = process.env.X102_CLEAN_ROOT;
const runtimePath = process.env.X102_RUNTIME_PATH;
const captureOutDir = process.env.X102_CAPTURE_OUT_DIR;
const stageLogPath = process.env.X102_STAGE_LOG_PATH || '';
const cleanHead = process.env.X102_CLEAN_HEAD || '';

if (!cleanRoot || !runtimePath || !captureOutDir) {
  console.error('X102_CAPTURE_HELPER_ENV_MISSING');
  process.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logStage(message) {
  if (!stageLogPath) return;
  await fs.mkdir(path.dirname(stageLogPath), { recursive: true });
  await fs.appendFile(stageLogPath, `${new Date().toISOString()} ${message}\n`);
}

function clampRect(rect, maxWidth, maxHeight) {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const width = Math.max(1, Math.min(Math.ceil(rect.width), maxWidth - x));
  const height = Math.max(1, Math.min(Math.ceil(rect.height), maxHeight - y));
  return { x, y, width, height };
}

function unionRects(...rects) {
  const valid = rects.filter((rect) =>
    rect
    && Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width > 0
    && rect.height > 0
  );
  if (!valid.length) return null;
  const left = Math.min(...valid.map((rect) => rect.x));
  const top = Math.min(...valid.map((rect) => rect.y));
  const right = Math.max(...valid.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...valid.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

process.chdir(cleanRoot);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer');
process.argv.push('--dev');

require(path.join(cleanRoot, 'src', 'main.js'));

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

async function collectState(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      const rectOf = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      };
      const rawStorage = (key) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      };
      const parseStorage = (key) => {
        try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      };
      const configuratorPanel = document.querySelector('[data-configurator-panel]');
      const gridButton = document.querySelector('[data-grid-button]');
      const paperObject = document.querySelector('.editor-page') || document.querySelector('.editor-panel');
      const paperRect = paperObject ? paperObject.getBoundingClientRect() : null;
      return {
        viewport: {
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        activePanelState: {
          configuratorOpen: Boolean(configuratorPanel && !configuratorPanel.hidden),
          leftSearchOpen: Boolean(document.querySelector('[data-left-search-panel]') && !document.querySelector('[data-left-search-panel]').hidden)
        },
        uiStateRaw: {
          yalkenLiteralStageAToolbarState: rawStorage('yalkenLiteralStageAToolbarState'),
          yalkenLiteralStageAToolbarItemOffsets: rawStorage('yalkenLiteralStageAToolbarItemOffsets'),
          yalkenLeftToolbarState: rawStorage('yalkenLeftToolbarState'),
          yalkenLeftToolbarButtonOffsets: rawStorage('yalkenLeftToolbarButtonOffsets'),
          yalkenConfiguratorBuckets: rawStorage('yalkenConfiguratorBuckets')
        },
        uiStateParsed: {
          yalkenLiteralStageAToolbarState: parseStorage('yalkenLiteralStageAToolbarState'),
          yalkenLiteralStageAToolbarItemOffsets: parseStorage('yalkenLiteralStageAToolbarItemOffsets'),
          yalkenLeftToolbarState: parseStorage('yalkenLeftToolbarState'),
          yalkenLeftToolbarButtonOffsets: parseStorage('yalkenLeftToolbarButtonOffsets'),
          yalkenConfiguratorBuckets: parseStorage('yalkenConfiguratorBuckets')
        },
        rects: {
          topWorkBar: rectOf('[data-top-work-bar]'),
          toolbarShell: rectOf('[data-toolbar-shell]'),
          leftToolbarShell: rectOf('[data-left-toolbar-shell]'),
          leftCluster: rectOf('.left-floating-toolbar .work-bar__cluster'),
          configuratorPanel: rectOf('[data-configurator-panel]')
        },
        paperObjectState: {
          selector: paperObject ? (paperObject.classList.contains('editor-page') ? '.editor-page' : '.editor-panel') : null,
          rect: paperRect ? {
            x: paperRect.x,
            y: paperRect.y,
            width: paperRect.width,
            height: paperRect.height
          } : null,
          classes: paperObject ? Array.from(paperObject.classList) : []
        },
        gridButtonState: gridButton ? {
          ariaExpanded: gridButton.getAttribute('aria-expanded'),
          ariaPressed: gridButton.getAttribute('aria-pressed'),
          className: gridButton.className
        } : null
      };
    })();
  `, true);
}

async function openConfigurator(win) {
  return win.webContents.executeJavaScript(`
    (() => new Promise((resolve) => {
      const button = document.querySelector('[data-grid-button]');
      if (!button) {
        resolve({ ok: false, reason: 'GRID_BUTTON_MISSING' });
        return;
      }
      if (button.getAttribute('aria-expanded') !== 'true') {
        button.click();
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const panel = document.querySelector('[data-configurator-panel]');
          resolve({ ok: Boolean(panel && !panel.hidden) });
        });
      });
    }))();
  `, true);
}

async function writeImage(image, basename, rect, files) {
  const outputPath = path.join(captureOutDir, basename);
  const cropped = rect
    ? image.crop(clampRect(rect, image.getSize().width, image.getSize().height))
    : image;
  const png = cropped.toPNG();
  await fs.writeFile(outputPath, png);
  files.push({
    basename,
    sha256: sha256(png),
    width: cropped.getSize().width,
    height: cropped.getSize().height
  });
}

async function main() {
  await logStage('helper_boot');
  await logStage('wait_for_window');
  const win = await waitForWindow();
  await logStage('window_ready');
  await waitForLoad(win);
  await logStage('load_complete');
  win.setContentSize(2048, 1110);
  await sleep(1200);
  await win.webContents.executeJavaScript(`
    (() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    })();
  `, true);
  await sleep(300);

  const closedState = await collectState(win);
  await logStage('closed_state_collected');
  const fullCapture = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: closedState.viewport.clientWidth,
    height: closedState.viewport.clientHeight
  });
  await logStage('master_capture_done');

  const topCompositionRect = unionRects(
    closedState.rects.topWorkBar,
    closedState.rects.toolbarShell,
    closedState.rects.leftToolbarShell
  );
  const toolbarRect = closedState.rects.toolbarShell;
  const leftClusterRect = closedState.rects.leftToolbarShell || closedState.rects.leftCluster;

  const openResult = await openConfigurator(win);
  if (!openResult.ok) {
    throw new Error('CONFIGURATOR_OPEN_FAILED');
  }
  await sleep(300);

  const openState = await collectState(win);
  await logStage('open_state_collected');
  const panelCapture = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: openState.viewport.clientWidth,
    height: openState.viewport.clientHeight
  });

  if (!topCompositionRect || !toolbarRect || !leftClusterRect || !openState.rects.configuratorPanel) {
    throw new Error('REQUIRED_CAPTURE_RECT_MISSING');
  }

  await fs.mkdir(captureOutDir, { recursive: true });
  const files = [];
  await writeImage(fullCapture, 'x102_master_screen_02.png', null, files);
  await writeImage(fullCapture, 'x102_crop_block01_top_composition_02.png', topCompositionRect, files);
  await writeImage(fullCapture, 'x102_crop_block01_toolbar_02.png', toolbarRect, files);
  await writeImage(fullCapture, 'x102_crop_block01_left_cluster_02.png', leftClusterRect, files);
  await writeImage(panelCapture, 'x102_crop_block01_compact_panel_02.png', openState.rects.configuratorPanel, files);
  await logStage('pngs_written');

  const runtimePayload = {
    cleanSurfaceHead: cleanHead,
    launchRoute: 'local_electron_binary_repo_local_helper',
    captureRoute: [
      'launch_clean_surface_helper',
      'wait_for_window',
      'capture_closed_state',
      'open_configurator',
      'capture_open_state'
    ],
    windowGeometry: win.getBounds(),
    closedState,
    openState,
    generatedFiles: files
  };
  await fs.writeFile(runtimePath, JSON.stringify(runtimePayload, null, 2));
  await logStage('runtime_written');
}

app.whenReady().then(async () => {
  try {
    await logStage('app_when_ready');
    await main();
    app.exit(0);
  } catch (error) {
    await logStage(`error:${error && error.message ? error.message : String(error)}`);
    console.error(error && error.stack ? error.stack : String(error));
    app.exit(1);
  }
});
