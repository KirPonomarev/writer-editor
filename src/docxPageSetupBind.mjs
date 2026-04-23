import { normalizeBookProfile } from './core/bookProfile.mjs';

const TWIPS_PER_MM = 1440 / 25.4;

function roundTwips(valueMm) {
  return Math.max(0, Math.round(Number(valueMm || 0) * TWIPS_PER_MM));
}

function createInvalidBookProfileError(normalizedResult) {
  const issueCodes = Array.isArray(normalizedResult?.issues)
    ? normalizedResult.issues.map((issue) => issue?.code).filter(Boolean)
    : [];
  const suffix = issueCodes.length ? `:${issueCodes.join(',')}` : '';
  const error = new Error(`E_DOCX_BOOK_PROFILE_INVALID${suffix}`);
  error.code = 'E_DOCX_BOOK_PROFILE_INVALID';
  error.issues = Array.isArray(normalizedResult?.issues) ? normalizedResult.issues : [];
  return error;
}

export function buildDocxPageSetup(profile) {
  const normalizedResult = normalizeBookProfile(profile);
  if (!normalizedResult.ok) {
    throw createInvalidBookProfileError(normalizedResult);
  }

  const value = normalizedResult.value;
  return {
    pageWidthTwips: roundTwips(value.widthMm),
    pageHeightTwips: roundTwips(value.heightMm),
    marginTopTwips: roundTwips(value.marginTopMm),
    marginRightTwips: roundTwips(value.marginRightMm),
    marginBottomTwips: roundTwips(value.marginBottomMm),
    marginLeftTwips: roundTwips(value.marginLeftMm),
    headerTwips: roundTwips(12.7),
    footerTwips: roundTwips(12.7),
    gutterTwips: 0,
  };
}

export function buildDocxSectionPropertiesXml(profile) {
  const pageSetup = buildDocxPageSetup(profile);
  return `<w:sectPr><w:pgSz w:w="${pageSetup.pageWidthTwips}" w:h="${pageSetup.pageHeightTwips}"/><w:pgMar w:top="${pageSetup.marginTopTwips}" w:right="${pageSetup.marginRightTwips}" w:bottom="${pageSetup.marginBottomTwips}" w:left="${pageSetup.marginLeftTwips}" w:header="${pageSetup.headerTwips}" w:footer="${pageSetup.footerTwips}" w:gutter="${pageSetup.gutterTwips}"/></w:sectPr>`;
}
