import { PX_PER_MM_AT_ZOOM_1 } from '../core/pageLayoutMetrics.mjs';

export const PREVIEW_CHROME_DEFAULT_PAGE_GAP_MM = 64 / PX_PER_MM_AT_ZOOM_1;
export const PREVIEW_CHROME_CANVAS_PADDING_PX = 48;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizePositiveNumber(value, fallback, min = 0) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate) || candidate < min) {
    return fallback;
  }

  return candidate;
}

export function createPreviewChromeState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return Object.freeze({
    pageGapMm: normalizePositiveNumber(source.pageGapMm, PREVIEW_CHROME_DEFAULT_PAGE_GAP_MM, 0),
    canvasPaddingPx: normalizePositiveNumber(source.canvasPaddingPx, PREVIEW_CHROME_CANVAS_PADDING_PX, 0),
  });
}

export function applyPreviewChromeCssVars(chrome, root = document.documentElement, zoom = 1, pxPerMm = PX_PER_MM_AT_ZOOM_1) {
  if (!root) {
    return;
  }

  const chromeState = createPreviewChromeState(chrome);
  root.style.setProperty(
    '--page-gap-px',
    `${Math.round(chromeState.pageGapMm * zoom * pxPerMm)}px`,
  );
  root.style.setProperty('--canvas-padding-px', `${Math.round(chromeState.canvasPaddingPx)}px`);
}
