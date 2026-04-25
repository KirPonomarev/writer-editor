'use strict';

const CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON = 'max-page-count';

function toPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function selectActiveLayoutPreviewSnapshotPageCount(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }
  const pageCount = snapshot.pageMap?.meta?.pageCount;
  return toPositiveInteger(pageCount, null);
}

function resolveCentralSheetStripProofDecision({
  naturalHeight,
  contentHeightPx,
  maxPageCount,
  activeLayoutPreviewSnapshot,
} = {}) {
  const activeLayoutPreviewSnapshotPageCount = selectActiveLayoutPreviewSnapshotPageCount(activeLayoutPreviewSnapshot);
  const hasActiveLayoutPreviewSnapshotPageCount = Boolean(activeLayoutPreviewSnapshotPageCount);
  const resolvedContentHeightPx = toPositiveNumber(contentHeightPx, 1);
  const resolvedNaturalHeight = Math.max(0, toPositiveNumber(naturalHeight, 0));
  const resolvedMaxPageCount = toPositiveInteger(maxPageCount, 1);
  const measuredPageCount = Math.max(1, Math.ceil(resolvedNaturalHeight / resolvedContentHeightPx));
  const pageCount = Math.max(activeLayoutPreviewSnapshotPageCount || 0, measuredPageCount);

  if (pageCount > resolvedMaxPageCount) {
    if (hasActiveLayoutPreviewSnapshotPageCount) {
      return {
        pageCount,
        visiblePageCount: resolvedMaxPageCount,
        overflowReason: CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
        shouldRender: true,
      };
    }

    return {
      pageCount,
      visiblePageCount: 0,
      overflowReason: CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
      shouldRender: false,
    };
  }

  return {
    pageCount,
    visiblePageCount: pageCount,
    overflowReason: '',
    shouldRender: true,
  };
}

module.exports = {
  CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
  resolveCentralSheetStripProofDecision,
  selectActiveLayoutPreviewSnapshotPageCount,
};
