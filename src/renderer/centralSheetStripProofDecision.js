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

function resolveCentralSheetStripProofDecision({
  naturalHeight,
  contentHeightPx,
  maxPageCount,
} = {}) {
  const resolvedContentHeightPx = toPositiveNumber(contentHeightPx, 1);
  const resolvedNaturalHeight = Math.max(0, toPositiveNumber(naturalHeight, 0));
  const resolvedMaxPageCount = toPositiveInteger(maxPageCount, 1);
  const pageCount = Math.max(1, Math.ceil(resolvedNaturalHeight / resolvedContentHeightPx));

  if (pageCount > resolvedMaxPageCount) {
    return {
      pageCount,
      overflowReason: CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
      shouldRender: false,
    };
  }

  return {
    pageCount,
    overflowReason: '',
    shouldRender: true,
  };
}

module.exports = {
  CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
  resolveCentralSheetStripProofDecision,
};
