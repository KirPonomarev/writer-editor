// ESM consumers use the same pure values without requiring an ESM module
// from a CommonJS exporter while its surrounding graph is still loading.
import typography from './inlineTypography.cjs';
export const { normalizeFontFamily, normalizeFontSize } = typography;
