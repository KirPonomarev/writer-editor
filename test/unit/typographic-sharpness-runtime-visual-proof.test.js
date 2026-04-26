const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = process.cwd();
const STYLES_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'styles.css');
const EDITOR_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'editor.js');
const TIPTAP_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'tiptap', 'index.js');
const REFERENCE_PACKET_PATH = path.join(
  REPO_ROOT,
  'docs',
  'references',
  'native-fluency-typographic-sharpness.md',
);

const PRIMARY_TEXT_SELECTORS = Object.freeze([
  '#editor.tiptap-host',
  '.tiptap-editor',
  '.ProseMirror',
]);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseCssRules(css) {
  const rules = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = null;
  while ((match = rulePattern.exec(css)) !== null) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (selector && body && !selector.startsWith('@')) {
      rules.push({ selector, body });
    }
  }
  return rules;
}

function selectorTouchesPrimaryText(selector) {
  return PRIMARY_TEXT_SELECTORS.some((primarySelector) => selector.includes(primarySelector));
}

function findForbiddenPrimaryTextRules(css) {
  return parseCssRules(css)
    .filter((rule) => selectorTouchesPrimaryText(rule.selector))
    .filter((rule) => /\btransform\s*:[^;]*\bscale(?:3d|X|Y|Z)?\s*\(/.test(rule.body));
}

function findChromeScaleBleedRules(css) {
  return parseCssRules(css)
    .filter((rule) => selectorTouchesPrimaryText(rule.selector))
    .filter((rule) => /--(?:left-|floating-)?toolbar-scale\b|--toolbar-scale\b/.test(rule.body));
}

function makeElectronProofHelperSource(outputDir) {
  return `
const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(REPO_ROOT)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
const proofJsonPath = path.join(outputDir, 'sharpness-proof-runtime.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function waitForEditor(win) {
  let lastState = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(100);
    lastState = await win.webContents.executeJavaScript(\`(() => {
      const host = document.querySelector('#editor.tiptap-host');
      const prose = document.querySelector('#editor.tiptap-host .ProseMirror');
      const editor = document.querySelector('#editor.tiptap-host .tiptap-editor');
      return {
        hostCount: document.querySelectorAll('#editor.tiptap-host').length,
        proseMirrorCount: document.querySelectorAll('#editor.tiptap-host .ProseMirror').length,
        tiptapEditorCount: document.querySelectorAll('#editor.tiptap-host .tiptap-editor').length,
        textLength: prose ? (prose.textContent || '').length : 0,
        hostTag: host ? host.tagName.toLowerCase() : '',
        editorTag: editor ? editor.tagName.toLowerCase() : '',
        proseTag: prose ? prose.tagName.toLowerCase() : '',
      };
    })()\`, true);
    if (lastState.hostCount === 1 && lastState.proseMirrorCount === 1 && lastState.tiptapEditorCount === 1) {
      return lastState;
    }
  }
  throw new Error('EDITOR_NOT_READY_' + JSON.stringify(lastState));
}

async function setEditorText(win) {
  win.webContents.send('editor:set-text', {
    content: 'Sharpness proof paragraph. Native DOM text must remain readable without fake scale zoom.',
    title: 'typographic-sharpness-proof',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'typographic-sharpness-proof',
    bookProfile: null,
  });
}

async function collectProof(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const editor = host ? host.querySelector('.tiptap-editor') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const styleOf = (el) => el ? getComputedStyle(el).transform : '';
    const textWalker = prose
      ? document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.textContent && node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        })
      : null;
    let textNodeCount = 0;
    if (textWalker) {
      while (textWalker.nextNode()) textNodeCount += 1;
    }
    const proseRect = prose ? prose.getBoundingClientRect() : null;
    return {
      hostCount: document.querySelectorAll('#editor.tiptap-host').length,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      canvasCountInsideHost: host ? host.querySelectorAll('canvas').length : 0,
      textNodeCount,
      textLength: prose ? (prose.textContent || '').length : 0,
      hostTag: host ? host.tagName.toLowerCase() : '',
      editorTag: editor ? editor.tagName.toLowerCase() : '',
      proseTag: prose ? prose.tagName.toLowerCase() : '',
      transforms: {
        host: styleOf(host),
        editor: styleOf(editor),
        prose: styleOf(prose),
      },
      proseRect: proseRect ? {
        x: proseRect.x,
        y: proseRect.y,
        width: proseRect.width,
        height: proseRect.height,
      } : null,
    };
  })()\`, true);
}

async function captureEvidence(win, proof) {
  await fs.mkdir(outputDir, { recursive: true });
  const fullImage = await win.capturePage();
  await fs.writeFile(path.join(outputDir, 'sharpness-proof-100.png'), fullImage.toPNG());

  if (proof.proseRect && proof.proseRect.width > 0 && proof.proseRect.height > 0) {
    const crop = {
      x: Math.max(0, Math.floor(proof.proseRect.x)),
      y: Math.max(0, Math.floor(proof.proseRect.y)),
      width: Math.max(1, Math.min(900, Math.floor(proof.proseRect.width))),
      height: Math.max(1, Math.min(500, Math.floor(proof.proseRect.height))),
    };
    const cropImage = await win.capturePage(crop);
    await fs.writeFile(path.join(outputDir, 'sharpness-proof-crop.png'), cropImage.toPNG());
  }
}

async function main() {
  await app.whenReady();
  dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/u.test(details.url)) {
      callback({ cancel: true });
      return;
    }
    callback({});
  });

  await import('file://' + mainEntrypoint);
  const win = await waitForWindow();
  await waitForLoad(win);
  await waitForEditor(win);
  await setEditorText(win);
  await sleep(500);
  const proof = await collectProof(win);
  await captureEvidence(win, proof);
  await fs.writeFile(proofJsonPath, JSON.stringify(proof, null, 2));
  app.quit();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  app.quit();
  process.exitCode = 1;
});
`;
}

function transformLooksScaled(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === 'none') return false;
  if (normalized === 'matrix(1, 0, 0, 1, 0, 0)') return false;
  return /matrix|scale/u.test(normalized);
}

function resolveElectronBinaryOrNull() {
  try {
    return require('electron');
  } catch (error) {
    const message = String(error && error.message ? error.message : '');
    if (error && error.code === 'MODULE_NOT_FOUND' && /\belectron\b/u.test(message)) {
      return null;
    }
    throw error;
  }
}

const electronProofRequested = process.env.SHARPNESS_RUN_ELECTRON_PROOF === '1';
const electronBinary = electronProofRequested ? resolveElectronBinaryOrNull() : null;
const electronProofSkipReason = !electronProofRequested
  ? 'set SHARPNESS_RUN_ELECTRON_PROOF=1 to collect local screenshot evidence'
  : (!electronBinary ? 'electron module is unavailable in this environment' : false);

test('typographic sharpness runtime proof: primary text source guards are deterministic', () => {
  const css = read(STYLES_PATH);
  const editorSource = read(EDITOR_SOURCE_PATH);
  const tiptapSource = read(TIPTAP_SOURCE_PATH);

  assert.equal(findForbiddenPrimaryTextRules(css).length, 0);
  assert.equal(findChromeScaleBleedRules(css).length, 0);
  assert.ok(editorSource.includes("editor.querySelector('.tiptap-editor')"));
  assert.ok(editorSource.includes("editor.querySelector('.ProseMirror')"));
  assert.ok(tiptapSource.includes("mountEl.classList.add('tiptap-host')"));
  assert.ok(tiptapSource.includes("contentEl.className = 'tiptap-editor'"));
  assert.equal(/document\.createElement\(['"]canvas['"]\)/.test(tiptapSource), false);
});

test('typographic sharpness runtime proof: negative source fixtures fail', () => {
  const scaledFixture = '.main-content--editor #editor.tiptap-host .ProseMirror { transform: scale(.95); }';
  const chromeBleedFixture = '.main-content--editor #editor.tiptap-host .ProseMirror { opacity: var(--toolbar-scale); }';
  const canvasFixture = "const textLayer = document.createElement('canvas');";

  assert.equal(findForbiddenPrimaryTextRules(scaledFixture).length, 1);
  assert.equal(findChromeScaleBleedRules(chromeBleedFixture).length, 1);
  assert.equal(/document\.createElement\(['"]canvas['"]\)/.test(canvasFixture), true);
});

test('typographic sharpness runtime proof: reference packet remains quality guard only', () => {
  const packet = read(REFERENCE_PACKET_PATH);

  assert.ok(packet.includes('DOCUMENT_CLASS: ADVISORY_QUALITY_GUARD_WITH_VIEWPORT_APPENDIX'));
  assert.ok(packet.includes('STRICT_STATUS: NOT_SECOND_CANON_NOT_EXECUTION_MASTER'));
  assert.ok(packet.includes('BLOCKING_SOURCE: ACTIVE_CANON_ONLY'));
  assert.ok(packet.includes('ADOPTION_05: DO_NOT_USE_THIS_PACKET_AS_WRITE_AUTHORITY'));
  assert.equal(packet.includes('DOCUMENT_CLASS: ACTIVE_EXECUTION_MASTER'), false);
});

test('typographic sharpness runtime proof: optional Electron DOM and screenshot evidence', {
  skip: electronProofSkipReason,
}, () => {
  const outputDir = process.env.SHARPNESS_PROOF_OUT_DIR
    ? path.resolve(process.env.SHARPNESS_PROOF_OUT_DIR)
    : path.join(REPO_ROOT, 'docs', 'tasks');
  const helperPath = path.join(os.tmpdir(), `sharpness-proof-helper-${process.pid}.cjs`);
  fs.writeFileSync(helperPath, makeElectronProofHelperSource(outputDir), 'utf8');

  const electronEnv = {
    ...process.env,
    SHARPNESS_PROOF_OUT_DIR: outputDir,
  };
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  const result = spawnSync(electronBinary, [helperPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: electronEnv,
    timeout: 30000,
  });

  try {
    fs.unlinkSync(helperPath);
  } catch {}

  assert.equal(result.status, 0, `electron proof failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  const proofJsonPath = path.join(outputDir, 'sharpness-proof-runtime.json');
  assert.ok(fs.existsSync(proofJsonPath), `missing runtime proof json\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  const proof = JSON.parse(fs.readFileSync(proofJsonPath, 'utf8'));

  assert.equal(proof.hostCount, 1);
  assert.equal(proof.proseMirrorCount, 1);
  assert.equal(proof.tiptapEditorCount, 1);
  assert.equal(proof.canvasCountInsideHost, 0);
  assert.ok(proof.textNodeCount > 0);
  assert.ok(proof.textLength > 0);
  assert.equal(proof.proseTag === 'canvas', false);
  assert.equal(transformLooksScaled(proof.transforms.host), false);
  assert.equal(transformLooksScaled(proof.transforms.editor), false);
  assert.equal(transformLooksScaled(proof.transforms.prose), false);
  assert.ok(fs.existsSync(path.join(outputDir, 'sharpness-proof-100.png')));
  assert.ok(fs.existsSync(path.join(outputDir, 'sharpness-proof-crop.png')));
});
