import { normalizeBookProfile } from '../core/bookProfile.mjs';
import {
  PX_PER_MM_AT_ZOOM_1,
  resolvePageLayoutMetrics,
} from '../core/pageLayoutMetrics.mjs';

export const PREVIEW_CHROME_FORMAT_IDS = Object.freeze(['A4', 'A5', 'LETTER']);
export const PREVIEW_CHROME_DEFAULT_FORMAT_ID = 'A4';
export const PREVIEW_CHROME_PAGE_GAP_MM = 20 / PX_PER_MM_AT_ZOOM_1;
export const PREVIEW_CHROME_CANVAS_PADDING_PX = 48;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeFormatId(formatId) {
  const candidate = typeof formatId === 'string' ? formatId.trim().toUpperCase() : '';
  return PREVIEW_CHROME_FORMAT_IDS.includes(candidate)
    ? candidate
    : PREVIEW_CHROME_DEFAULT_FORMAT_ID;
}

export function createPreviewChromeState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return Object.freeze({
    formatId: normalizeFormatId(source.formatId),
  });
}

function ok(value) {
  return Object.freeze({ ok: true, value, issues: Object.freeze([]) });
}

export function resolvePreviewChromeMetrics({
  profile,
  chrome = {},
  zoom = 1,
  pxPerMm = PX_PER_MM_AT_ZOOM_1,
} = {}) {
  const profileResult = normalizeBookProfile(profile);
  if (!profileResult.ok) {
    return profileResult;
  }

  const chromeState = createPreviewChromeState(chrome);
  const previewProfileResult = chromeState.formatId === profileResult.value.formatId
    ? ok(profileResult.value)
    : normalizeBookProfile({
        ...profileResult.value,
        formatId: chromeState.formatId,
      });

  if (!previewProfileResult.ok) {
    return previewProfileResult;
  }

  const metricsResult = resolvePageLayoutMetrics(previewProfileResult.value, {
    zoom,
    pxPerMm,
  });
  if (!metricsResult.ok) {
    return metricsResult;
  }

  return ok(Object.freeze({
    ...metricsResult.value,
    previewFormatId: chromeState.formatId,
    pageGapPx: Math.round(PREVIEW_CHROME_PAGE_GAP_MM * zoom * pxPerMm),
    canvasPaddingPx: PREVIEW_CHROME_CANVAS_PADDING_PX,
  }));
}

export function applyPreviewChromeCssVars(metrics, root = document.documentElement) {
  if (!metrics || !root) {
    return;
  }

  root.style.setProperty('--page-width-px', `${Math.round(metrics.pageWidthPx)}px`);
  root.style.setProperty('--page-height-px', `${Math.round(metrics.pageHeightPx)}px`);
  root.style.setProperty('--page-gap-px', `${Math.round(metrics.pageGapPx)}px`);
  root.style.setProperty('--page-margin-top-px', `${Math.round(metrics.marginTopPx)}px`);
  root.style.setProperty('--page-margin-right-px', `${Math.round(metrics.marginRightPx)}px`);
  root.style.setProperty('--page-margin-bottom-px', `${Math.round(metrics.marginBottomPx)}px`);
  root.style.setProperty('--page-margin-left-px', `${Math.round(metrics.marginLeftPx)}px`);
  root.style.setProperty('--canvas-padding-px', `${Math.round(metrics.canvasPaddingPx)}px`);
}
