// Pure values shared by the editor, import parser and Node 22.12+ exporters.
// No DOM, Node APIs, I/O or asynchronous module initialization.
const GENERIC_FONTS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer',
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong']);

export function normalizeFontFamily(value) {
  if (typeof value !== 'string' || value.length > 128 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('DOCX_FONT_FAMILY_INVALID');
  }
  let family = value.trim();
  if (/^("[^"]+"|'[^']+')$/u.test(family)) family = family.slice(1, -1).trim();
  if (!family || !/^[\p{L}\p{M}\p{N} _.'-]+$/u.test(family) || GENERIC_FONTS.has(family.toLowerCase())) {
    throw new Error('DOCX_FONT_FAMILY_INVALID');
  }
  return family;
}

export function normalizeFontSize(value) {
  if (typeof value !== 'string' || value.length > 32) throw new Error('DOCX_FONT_SIZE_INVALID');
  const match = /^(\d{1,4}(?:\.\d{1,4})?)(pt|px)$/u.exec(value.trim().toLowerCase());
  const points = match ? Number(match[1]) * (match[2] === 'px' ? 0.75 : 1) : NaN;
  if (!Number.isFinite(points) || points < 1 || points > 1638) throw new Error('DOCX_FONT_SIZE_INVALID');
  const halfPoints = Math.round(points * 2);
  if (Math.abs(points * 2 - halfPoints) > 1e-8) throw new Error('DOCX_FONT_SIZE_NOT_HALF_POINT_EXACT');
  return `${halfPoints / 2}pt`;
}
