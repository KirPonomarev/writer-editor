import { normalizeBookProfile } from './core/bookProfile.mjs';

const TWIPS_PER_MM = 1440 / 25.4;

function roundTwips(valueMm) {
  return Math.max(0, Math.round(Number(valueMm || 0) * TWIPS_PER_MM));
}

export function buildDocxPageSetup(profile) {
  const normalizedResult = normalizeBookProfile(profile);
  if (!normalizedResult.ok) {
    return {
      pageWidthTwips: roundTwips(210),
      pageHeightTwips: roundTwips(297),
      marginTopTwips: roundTwips(25.4),
      marginRightTwips: roundTwips(25.4),
      marginBottomTwips: roundTwips(25.4),
      marginLeftTwips: roundTwips(25.4),
      headerTwips: roundTwips(12.7),
      footerTwips: roundTwips(12.7),
      gutterTwips: 0,
    };
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
