import { normalizeBookProfile } from './bookProfile.mjs';

export const PX_PER_MM_AT_ZOOM_1 = 595 / 210;
export const PAGE_LAYOUT_RUNTIME_PX_PER_MM_BASELINE = PX_PER_MM_AT_ZOOM_1;

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function createIssue(code, path, message) {
  return Object.freeze({ code, path, message });
}

function ok(value) {
  return Object.freeze({ ok: true, value, issues: Object.freeze([]) });
}

function fail(...issues) {
  return Object.freeze({ ok: false, value: null, issues: Object.freeze(issues.flat()) });
}

function readPositiveNumber(value, fallback, code, path, label) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return { ok: true, value: fallback };
  }

  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    return {
      ok: false,
      issue: createIssue(code, path, `${label} must be a positive finite number.`),
    };
  }

  return { ok: true, value: next };
}

function mmToPx(mm, zoom, pxPerMm) {
  return round(mm * zoom * pxPerMm);
}

export function resolvePageLayoutMetrics(profile, options = {}) {
  const normalizedResult = normalizeBookProfile(profile);
  if (!normalizedResult.ok) {
    return normalizedResult;
  }

  const zoomResult = readPositiveNumber(options.zoom, 1, 'E_PAGE_LAYOUT_ZOOM', '$.zoom', 'zoom');
  if (!zoomResult.ok) {
    return fail(zoomResult.issue);
  }

  const pxPerMmResult = readPositiveNumber(
    options.pxPerMm,
    PAGE_LAYOUT_RUNTIME_PX_PER_MM_BASELINE,
    'E_PAGE_LAYOUT_PX_PER_MM',
    '$.pxPerMm',
    'pxPerMm',
  );
  if (!pxPerMmResult.ok) {
    return fail(pxPerMmResult.issue);
  }

  const profileValue = normalizedResult.value;
  const contentWidthMm = round(profileValue.widthMm - profileValue.marginLeftMm - profileValue.marginRightMm);
  const contentHeightMm = round(profileValue.heightMm - profileValue.marginTopMm - profileValue.marginBottomMm);

  if (contentWidthMm <= 0) {
    return fail(
      createIssue(
        'E_PAGE_LAYOUT_MARGIN_WIDTH_OVERFLOW',
        '$',
        'Horizontal margins overflow the page width.',
      ),
    );
  }

  if (contentHeightMm <= 0) {
    return fail(
      createIssue(
        'E_PAGE_LAYOUT_MARGIN_HEIGHT_OVERFLOW',
        '$',
        'Vertical margins overflow the page height.',
      ),
    );
  }

  const zoom = zoomResult.value;
  const pxPerMm = pxPerMmResult.value;
  return ok(Object.freeze({
    formatId: profileValue.formatId,
    orientation: profileValue.orientation,
    pageWidthMm: profileValue.widthMm,
    pageHeightMm: profileValue.heightMm,
    pageWidthPx: mmToPx(profileValue.widthMm, zoom, pxPerMm),
    pageHeightPx: mmToPx(profileValue.heightMm, zoom, pxPerMm),
    marginTopMm: profileValue.marginTopMm,
    marginRightMm: profileValue.marginRightMm,
    marginBottomMm: profileValue.marginBottomMm,
    marginLeftMm: profileValue.marginLeftMm,
    marginTopPx: mmToPx(profileValue.marginTopMm, zoom, pxPerMm),
    marginRightPx: mmToPx(profileValue.marginRightMm, zoom, pxPerMm),
    marginBottomPx: mmToPx(profileValue.marginBottomMm, zoom, pxPerMm),
    marginLeftPx: mmToPx(profileValue.marginLeftMm, zoom, pxPerMm),
    contentWidthMm,
    contentHeightMm,
    contentWidthPx: mmToPx(contentWidthMm, zoom, pxPerMm),
    contentHeightPx: mmToPx(contentHeightMm, zoom, pxPerMm),
  }));
}
