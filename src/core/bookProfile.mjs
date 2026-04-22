import {
  DEFAULT_PAGE_FORMAT_ID,
  getPageFormat,
  validatePageFormatId,
} from './pageFormatRegistry.mjs';

export const BOOK_PROFILE_SCHEMA_VERSION = 'book-profile.v1';
export const BOOK_PROFILE_ORIENTATIONS = Object.freeze(['portrait', 'landscape']);
export const BOOK_PROFILE_CHAPTER_START_RULES = Object.freeze(['continuous', 'next-page']);
export const BOOK_PROFILE_MODEL_KEYS = Object.freeze([
  'schemaVersion',
  'profileId',
  'formatId',
  'widthMm',
  'heightMm',
  'orientation',
  'marginTopMm',
  'marginRightMm',
  'marginBottomMm',
  'marginLeftMm',
  'chapterStartRule',
  'allowExplicitPageBreaks',
]);
export const BOOK_PROFILE_SCREEN_CHROME_KEYS = Object.freeze([
  'zoom',
  'pageWidthPx',
  'pageHeightPx',
  'contentWidthPx',
  'contentHeightPx',
  'marginTopPx',
  'marginRightPx',
  'marginBottomPx',
  'marginLeftPx',
  'viewportWidthPx',
  'viewportHeightPx',
]);

const DEFAULT_PROFILE_ID = 'default-book-profile';
const DEFAULT_MARGIN_MM = 25.4;
const MIN_WIDTH_MM = 90;
const MAX_WIDTH_MM = 400;
const MIN_HEIGHT_MM = 120;
const MAX_HEIGHT_MM = 500;
const MAX_MARGIN_MM = 80;
const MIN_CONTENT_BOX_MM = 20;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function isCloseEnough(left, right, epsilon = 0.001) {
  return Math.abs(left - right) <= epsilon;
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

function readNumber(value, fallback) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return { ok: true, value: fallback };
  }

  const next = Number(value);
  if (!Number.isFinite(next)) {
    return { ok: false, value };
  }

  return { ok: true, value: next };
}

function normalizeOrientation(orientation) {
  return typeof orientation === 'string' && orientation.trim()
    ? orientation.trim().toLowerCase()
    : 'portrait';
}

function normalizeProfileId(profileId) {
  return typeof profileId === 'string' && profileId.trim() ? profileId.trim() : DEFAULT_PROFILE_ID;
}

function buildNormalizedCandidate(input = {}) {
  if (!isPlainObject(input)) {
    return fail(createIssue('E_BOOK_PROFILE_OBJECT', '$', 'bookProfile input must be a plain object.'));
  }

  const formatId = typeof input.formatId === 'string' && input.formatId.trim()
    ? input.formatId.trim().toUpperCase()
    : DEFAULT_PAGE_FORMAT_ID;
  const formatResult = validatePageFormatId(formatId);
  if (!formatResult.ok) {
    return formatResult;
  }

  const format = formatResult.value;
  const orientation = normalizeOrientation(input.orientation);
  const widthSource = format.formatId === 'CUSTOM'
    ? readNumber(input.widthMm, format.widthMm)
    : { ok: true, value: format.widthMm };
  const heightSource = format.formatId === 'CUSTOM'
    ? readNumber(input.heightMm, format.heightMm)
    : { ok: true, value: format.heightMm };

  if (!widthSource.ok) {
    return fail(createIssue('E_BOOK_PROFILE_WIDTH_MM', '$.widthMm', 'widthMm must be a finite number.'));
  }
  if (!heightSource.ok) {
    return fail(createIssue('E_BOOK_PROFILE_HEIGHT_MM', '$.heightMm', 'heightMm must be a finite number.'));
  }

  let widthMm = widthSource.value;
  let heightMm = heightSource.value;
  if (orientation === 'portrait' && widthMm > heightMm) {
    [widthMm, heightMm] = [heightMm, widthMm];
  }
  if (orientation === 'landscape' && widthMm < heightMm) {
    [widthMm, heightMm] = [heightMm, widthMm];
  }

  const marginTop = readNumber(input.marginTopMm, DEFAULT_MARGIN_MM);
  const marginRight = readNumber(input.marginRightMm, DEFAULT_MARGIN_MM);
  const marginBottom = readNumber(input.marginBottomMm, DEFAULT_MARGIN_MM);
  const marginLeft = readNumber(input.marginLeftMm, DEFAULT_MARGIN_MM);

  if (!marginTop.ok || !marginRight.ok || !marginBottom.ok || !marginLeft.ok) {
    return fail(createIssue('E_BOOK_PROFILE_MARGIN_MM', '$', 'All margins must be finite numbers.'));
  }

  const value = Object.freeze({
    schemaVersion: BOOK_PROFILE_SCHEMA_VERSION,
    profileId: normalizeProfileId(input.profileId),
    formatId: format.formatId,
    widthMm: round(widthMm),
    heightMm: round(heightMm),
    orientation,
    marginTopMm: round(marginTop.value),
    marginRightMm: round(marginRight.value),
    marginBottomMm: round(marginBottom.value),
    marginLeftMm: round(marginLeft.value),
    chapterStartRule: typeof input.chapterStartRule === 'string' && input.chapterStartRule.trim()
      ? input.chapterStartRule.trim()
      : 'next-page',
    allowExplicitPageBreaks: typeof input.allowExplicitPageBreaks === 'undefined'
      ? true
      : input.allowExplicitPageBreaks,
  });

  return ok(value);
}

export function validateBookProfile(input = {}) {
  if (!isPlainObject(input)) {
    return fail(createIssue('E_BOOK_PROFILE_OBJECT', '$', 'bookProfile input must be a plain object.'));
  }

  const issues = [];
  if (input.schemaVersion !== BOOK_PROFILE_SCHEMA_VERSION) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_SCHEMA_VERSION',
        '$.schemaVersion',
        `schemaVersion must equal ${BOOK_PROFILE_SCHEMA_VERSION}.`,
      ),
    );
  }

  if (typeof input.profileId !== 'string' || !input.profileId.trim()) {
    issues.push(createIssue('E_BOOK_PROFILE_PROFILE_ID', '$.profileId', 'profileId must be a non-empty string.'));
  }

  const formatResult = validatePageFormatId(input.formatId);
  if (!formatResult.ok) {
    issues.push(...formatResult.issues);
  }
  const format = formatResult.ok ? formatResult.value : null;

  if (!BOOK_PROFILE_ORIENTATIONS.includes(input.orientation)) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_ORIENTATION',
        '$.orientation',
        `orientation must be one of: ${BOOK_PROFILE_ORIENTATIONS.join(', ')}.`,
      ),
    );
  }

  const widthMm = Number(input.widthMm);
  const heightMm = Number(input.heightMm);
  if (!Number.isFinite(widthMm) || widthMm < MIN_WIDTH_MM || widthMm > MAX_WIDTH_MM) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_WIDTH_MM',
        '$.widthMm',
        `widthMm must be between ${MIN_WIDTH_MM} and ${MAX_WIDTH_MM}.`,
      ),
    );
  }
  if (!Number.isFinite(heightMm) || heightMm < MIN_HEIGHT_MM || heightMm > MAX_HEIGHT_MM) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_HEIGHT_MM',
        '$.heightMm',
        `heightMm must be between ${MIN_HEIGHT_MM} and ${MAX_HEIGHT_MM}.`,
      ),
    );
  }

  if (input.orientation === 'portrait' && widthMm > heightMm) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_GEOMETRY_ORIENTATION',
        '$',
        'portrait book profiles must keep widthMm <= heightMm.',
      ),
    );
  }
  if (input.orientation === 'landscape' && widthMm < heightMm) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_GEOMETRY_ORIENTATION',
        '$',
        'landscape book profiles must keep widthMm >= heightMm.',
      ),
    );
  }

  if (format && format.formatId !== 'CUSTOM') {
    const expectedWidthMm = input.orientation === 'landscape' ? format.heightMm : format.widthMm;
    const expectedHeightMm = input.orientation === 'landscape' ? format.widthMm : format.heightMm;
    if (!isCloseEnough(widthMm, expectedWidthMm) || !isCloseEnough(heightMm, expectedHeightMm)) {
      issues.push(
        createIssue(
          'E_BOOK_PROFILE_FORMAT_DIMENSIONS',
          '$',
          `formatId ${format.formatId} must use canonical dimensions for ${input.orientation} orientation.`,
        ),
      );
    }
  }

  for (const key of ['marginTopMm', 'marginRightMm', 'marginBottomMm', 'marginLeftMm']) {
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < 0 || value > MAX_MARGIN_MM) {
      issues.push(
        createIssue(
          'E_BOOK_PROFILE_MARGIN_MM',
          `$.${key}`,
          `${key} must be between 0 and ${MAX_MARGIN_MM}.`,
        ),
      );
    }
  }

  if (!BOOK_PROFILE_CHAPTER_START_RULES.includes(input.chapterStartRule)) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_CHAPTER_START_RULE',
        '$.chapterStartRule',
        `chapterStartRule must be one of: ${BOOK_PROFILE_CHAPTER_START_RULES.join(', ')}.`,
      ),
    );
  }

  if (typeof input.allowExplicitPageBreaks !== 'boolean') {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_ALLOW_BREAKS',
        '$.allowExplicitPageBreaks',
        'allowExplicitPageBreaks must be boolean.',
      ),
    );
  }

  for (const key of BOOK_PROFILE_SCREEN_CHROME_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      issues.push(
        createIssue(
          'E_BOOK_PROFILE_SCREEN_CHROME_FIELD',
          `$.${key}`,
          `${key} is screen chrome state and must not be stored in bookProfile.`,
        ),
      );
    }
  }

  const horizontalMargins = Number(input.marginLeftMm) + Number(input.marginRightMm);
  const verticalMargins = Number(input.marginTopMm) + Number(input.marginBottomMm);
  if (Number.isFinite(widthMm) && horizontalMargins > widthMm - MIN_CONTENT_BOX_MM) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_MARGIN_WIDTH_OVERFLOW',
        '$',
        'Horizontal margins leave no usable text box.',
      ),
    );
  }
  if (Number.isFinite(heightMm) && verticalMargins > heightMm - MIN_CONTENT_BOX_MM) {
    issues.push(
      createIssue(
        'E_BOOK_PROFILE_MARGIN_HEIGHT_OVERFLOW',
        '$',
        'Vertical margins leave no usable text box.',
      ),
    );
  }

  return issues.length ? fail(issues) : ok(Object.freeze({ ...input }));
}

export function normalizeBookProfile(input = {}) {
  const candidateResult = buildNormalizedCandidate(input);
  if (!candidateResult.ok) {
    return candidateResult;
  }

  const validation = validateBookProfile(candidateResult.value);
  if (!validation.ok) {
    return validation;
  }

  return ok(candidateResult.value);
}

export function createDefaultBookProfile(overrides = {}) {
  const result = normalizeBookProfile({
    profileId: DEFAULT_PROFILE_ID,
    formatId: DEFAULT_PAGE_FORMAT_ID,
    orientation: 'portrait',
    marginTopMm: DEFAULT_MARGIN_MM,
    marginRightMm: DEFAULT_MARGIN_MM,
    marginBottomMm: DEFAULT_MARGIN_MM,
    marginLeftMm: DEFAULT_MARGIN_MM,
    chapterStartRule: 'next-page',
    allowExplicitPageBreaks: true,
    ...overrides,
  });

  if (!result.ok) {
    const message = result.issues.map((issue) => issue.code).join(', ') || 'E_BOOK_PROFILE_INVALID_DEFAULTS';
    throw new Error(message);
  }

  return result.value;
}
