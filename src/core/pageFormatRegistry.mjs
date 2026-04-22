export const DEFAULT_PAGE_FORMAT_ID = 'A4';

const PAGE_FORMATS = Object.freeze([
  Object.freeze({ formatId: 'A4', label: 'A4', widthMm: 210, heightMm: 297 }),
  Object.freeze({ formatId: 'A5', label: 'A5', widthMm: 148, heightMm: 210 }),
  Object.freeze({ formatId: 'LETTER', label: 'Letter', widthMm: 215.9, heightMm: 279.4 }),
  Object.freeze({ formatId: 'LEGAL', label: 'Legal', widthMm: 215.9, heightMm: 355.6 }),
  Object.freeze({ formatId: 'SIX_BY_NINE', label: '6 x 9', widthMm: 152.4, heightMm: 228.6 }),
  Object.freeze({ formatId: 'CUSTOM', label: 'Custom', widthMm: 210, heightMm: 297 }),
]);

const PAGE_FORMATS_BY_ID = new Map(PAGE_FORMATS.map((entry) => [entry.formatId, entry]));

function normalizeFormatId(formatId) {
  return typeof formatId === 'string' ? formatId.trim().toUpperCase() : '';
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

export const PAGE_FORMAT_IDS = Object.freeze(PAGE_FORMATS.map((entry) => entry.formatId));

export function listPageFormats() {
  return PAGE_FORMATS.slice();
}

export function getPageFormat(formatId = DEFAULT_PAGE_FORMAT_ID) {
  const normalized = normalizeFormatId(formatId || DEFAULT_PAGE_FORMAT_ID);
  return PAGE_FORMATS_BY_ID.get(normalized) || null;
}

export function validatePageFormatId(formatId, path = '$.formatId') {
  const entry = getPageFormat(formatId);
  if (entry) {
    return ok(entry);
  }

  return fail(
    createIssue(
      'E_PAGE_FORMAT_ID',
      path,
      `formatId must be one of: ${PAGE_FORMAT_IDS.join(', ')}.`,
    ),
  );
}
