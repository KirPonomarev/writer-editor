import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCurrentStaticPageExpectedFailFixture,
  createGapFailureViewportFixture,
  createPassingViewportFixture,
  createScaleCanvasFailureViewportFixture,
} from '../test/fixtures/viewport-oracle-fixture.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

const FAILURE_CODES = Object.freeze({
  SECOND_TIPTAP: 'E_VIEWPORT_SECOND_TIPTAP',
  SECOND_PROSEMIRROR: 'E_VIEWPORT_SECOND_PROSEMIRROR',
  PRIMARY_TEXT_BITMAP: 'E_VIEWPORT_PRIMARY_TEXT_BITMAP',
  PRIMARY_TEXT_SCALE: 'E_VIEWPORT_PRIMARY_TEXT_SCALE',
  TEXT_LOST_AFTER_BOUNDARY: 'E_VIEWPORT_TEXT_LOST_AFTER_BOUNDARY',
  TEXT_IN_GAP: 'E_VIEWPORT_TEXT_IN_GAP',
  STATIC_SINGLE_PAGE: 'E_VIEWPORT_STATIC_SINGLE_PAGE_SHELL',
});

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rectsIntersect(a, b) {
  const aLeft = asNumber(a.left);
  const aTop = asNumber(a.top);
  const aRight = aLeft + asNumber(a.width);
  const aBottom = aTop + asNumber(a.height);
  const bLeft = asNumber(b.left);
  const bTop = asNumber(b.top);
  const bRight = bLeft + asNumber(b.width);
  const bBottom = bTop + asNumber(b.height);
  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function transformHasScale(transform) {
  const value = String(transform || '').trim().toLowerCase();
  if (!value || value === 'none') return false;
  if (/\bscale(?:3d|x|y)?\s*\(/u.test(value)) return true;
  if (value.startsWith('matrix(') || value.startsWith('matrix3d(')) return true;
  return false;
}

export function evaluateViewportOracleSnapshot(snapshot = {}) {
  const failures = [];
  const tiptapHostCount = asNumber(snapshot.tiptapHostCount);
  const proseMirrorCount = asNumber(snapshot.proseMirrorCount);
  const primarySurface = snapshot.primaryTextSurface || {};
  const sheets = Array.isArray(snapshot.sheets) ? snapshot.sheets : [];
  const gapRects = Array.isArray(snapshot.gapRects) ? snapshot.gapRects : [];
  const textRects = Array.isArray(snapshot.textRects) ? snapshot.textRects : [];
  const continuationProbe = snapshot.continuationProbe || {};

  if (tiptapHostCount !== 1) failures.push(FAILURE_CODES.SECOND_TIPTAP);
  if (proseMirrorCount !== 1) failures.push(FAILURE_CODES.SECOND_PROSEMIRROR);
  if (primarySurface.isCanvasBitmap || String(primarySurface.tagName || '').toLowerCase() === 'canvas') {
    failures.push(FAILURE_CODES.PRIMARY_TEXT_BITMAP);
  }
  if (transformHasScale(primarySurface.computedStyle?.transform || primarySurface.inlineStyle?.transform)) {
    failures.push(FAILURE_CODES.PRIMARY_TEXT_SCALE);
  }
  if (sheets.length < 2 && continuationProbe.hasTextBeforeBoundary) {
    failures.push(FAILURE_CODES.STATIC_SINGLE_PAGE);
  }
  if (
    continuationProbe.hasTextBeforeBoundary
    && (!continuationProbe.hasTextAfterBoundary || !continuationProbe.nextSheetHasTextAfterBoundary)
  ) {
    failures.push(FAILURE_CODES.TEXT_LOST_AFTER_BOUNDARY);
  }
  if (continuationProbe.textHiddenInsideSinglePageScroll) {
    failures.push(FAILURE_CODES.TEXT_LOST_AFTER_BOUNDARY);
  }

  for (const textRect of textRects) {
    for (const gapRect of gapRects) {
      if (rectsIntersect(textRect, gapRect)) {
        failures.push(FAILURE_CODES.TEXT_IN_GAP);
      }
    }
  }

  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    facts: {
      tiptapHostCount,
      proseMirrorCount,
      sheetCount: sheets.length,
      gapRectCount: gapRects.length,
      textRectCount: textRects.length,
      primaryTextSurfaceTagName: primarySurface.tagName || '',
      primaryTextSurfaceIsCanvasBitmap: Boolean(primarySurface.isCanvasBitmap),
      primaryTextTransform: primarySurface.computedStyle?.transform || primarySurface.inlineStyle?.transform || '',
    },
  };
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

export function collectCurrentSourceViewportFacts(repoRoot = DEFAULT_REPO_ROOT) {
  const tiptapSource = readIfExists(path.join(repoRoot, 'src', 'renderer', 'tiptap', 'index.js'));
  const styleSource = readIfExists(path.join(repoRoot, 'src', 'renderer', 'styles.css'));
  const editorSource = readIfExists(path.join(repoRoot, 'src', 'renderer', 'editor.js'));

  const newEditorCount = countMatches(tiptapSource, /\bnew\s+Editor\s*\(/gu);
  const tiptapPageWrapCount = countMatches(tiptapSource, /tiptap-page-wrap/gu);
  const canvasInTiptapSource = /\bcreateElement\(\s*['"]canvas['"]\s*\)/u.test(tiptapSource);
  const primaryTextScaleInCss = /#editor\.tiptap-host[\s\S]{0,260}transform\s*:\s*scale\(/u.test(styleSource)
    || /\.ProseMirror[\s\S]{0,260}transform\s*:\s*scale\(/u.test(styleSource)
    || /\.tiptap-editor[\s\S]{0,260}transform\s*:\s*scale\(/u.test(styleSource);
  const tiptapPageOverflowHidden = /\.tiptap-page\s*\{[\s\S]*?overflow:\s*hidden\s*;/u.test(styleSource);
  const tiptapPageContentOverflowAuto = /\.tiptap-page__content\s*\{[\s\S]*?overflow-y:\s*auto\s*;/u.test(styleSource);
  const legacyPaginatorPresent = /\bfunction\s+paginateNodes\s*\(/u.test(editorSource);

  return {
    tiptapHostCount: 1,
    proseMirrorCount: newEditorCount,
    primaryTextSurfaceTagName: 'div',
    primaryTextSurfaceIsCanvasBitmap: canvasInTiptapSource,
    primaryTextTransform: primaryTextScaleInCss ? 'scale(source-css)' : 'none',
    source: {
      newEditorCount,
      tiptapPageWrapCount,
      tiptapPageOverflowHidden,
      tiptapPageContentOverflowAuto,
      legacyPaginatorPresent,
      canvasInTiptapSource,
      primaryTextScaleInCss,
    },
  };
}

export function runMinimalOracleSmoke(options = {}) {
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const passing = evaluateViewportOracleSnapshot(createPassingViewportFixture());
  const gapFailure = evaluateViewportOracleSnapshot(createGapFailureViewportFixture());
  const scaleCanvasFailure = evaluateViewportOracleSnapshot(createScaleCanvasFailureViewportFixture());
  const sourceFacts = collectCurrentSourceViewportFacts(repoRoot);
  const current = evaluateViewportOracleSnapshot(createCurrentStaticPageExpectedFailFixture(sourceFacts));

  const currentExpectedFailures = new Set([
    FAILURE_CODES.STATIC_SINGLE_PAGE,
    FAILURE_CODES.TEXT_LOST_AFTER_BOUNDARY,
  ]);
  const currentExpectedFail = current.failures.length > 0
    && current.failures.every((failure) => currentExpectedFailures.has(failure));

  return {
    ok: passing.ok
      && gapFailure.failures.includes(FAILURE_CODES.TEXT_IN_GAP)
      && scaleCanvasFailure.failures.includes(FAILURE_CODES.PRIMARY_TEXT_BITMAP)
      && scaleCanvasFailure.failures.includes(FAILURE_CODES.PRIMARY_TEXT_SCALE)
      && currentExpectedFail,
    passing,
    gapFailure,
    scaleCanvasFailure,
    current,
    sourceFacts,
    currentExpectedFail,
  };
}

function boolToken(value) {
  return value ? '1' : '0';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runMinimalOracleSmoke();
  process.stdout.write(`VIEWPORT_MINIMAL_ORACLE_SMOKE_OK=${boolToken(result.ok)}\n`);
  process.stdout.write(`PASSING_FIXTURE_ORACLE_OK=${boolToken(result.passing.ok)}\n`);
  process.stdout.write(`NEGATIVE_GAP_REJECTED=${boolToken(result.gapFailure.failures.includes(FAILURE_CODES.TEXT_IN_GAP))}\n`);
  process.stdout.write(`NEGATIVE_SCALE_REJECTED=${boolToken(result.scaleCanvasFailure.failures.includes(FAILURE_CODES.PRIMARY_TEXT_SCALE))}\n`);
  process.stdout.write(`NEGATIVE_CANVAS_REJECTED=${boolToken(result.scaleCanvasFailure.failures.includes(FAILURE_CODES.PRIMARY_TEXT_BITMAP))}\n`);
  process.stdout.write(`CURRENT_RUNTIME_EXPECTED_FAIL=${boolToken(result.currentExpectedFail)}\n`);
  process.stdout.write(`CURRENT_RUNTIME_FAILURES=${result.current.failures.join(',')}\n`);
  process.stdout.write(`CURRENT_NEW_EDITOR_COUNT=${result.sourceFacts.source.newEditorCount}\n`);
  process.stdout.write(`CURRENT_STATIC_TIPTAP_PAGE_WRAP_COUNT=${result.sourceFacts.source.tiptapPageWrapCount}\n`);
  process.stdout.write(`CURRENT_PRIMARY_TEXT_SCALE_IN_CSS=${boolToken(result.sourceFacts.source.primaryTextScaleInCss)}\n`);
  process.stdout.write(`CURRENT_TIPTAP_CANVAS_TEXT=${boolToken(result.sourceFacts.source.canvasInTiptapSource)}\n`);
  process.exit(result.ok ? 0 : 1);
}
