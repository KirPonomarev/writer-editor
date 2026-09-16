// Word highlight names use the Office palette, not CSS named-color values.
const PALETTE = [
  ['black', '#000000'], ['blue', '#0000ff'], ['cyan', '#00ffff'],
  ['darkBlue', '#000080'], ['darkCyan', '#008080'], ['darkGray', '#808080'],
  ['darkGreen', '#008000'], ['darkMagenta', '#800080'], ['darkRed', '#800000'],
  ['darkYellow', '#808000'], ['green', '#00ff00'], ['lightGray', '#c0c0c0'],
  ['magenta', '#ff00ff'], ['red', '#ff0000'], ['white', '#ffffff'], ['yellow', '#ffff00'],
];
const WORD_HIGHLIGHT_COLOR_BY_NAME = Object.freeze(Object.fromEntries(PALETTE.map(([name, color]) => [name.toLowerCase(), color])));
const WORD_HIGHLIGHT_NAME_BY_COLOR = Object.freeze(Object.fromEntries(PALETTE.map(([name, color]) => [color, name])));

function normalizeOpaqueRgb(value) {
  if (typeof value !== 'string' || value.length > 64) throw new Error('DOCX_COLOR_RGB_INVALID');
  const text = value.trim().toLowerCase();
  if (/^#[a-f0-9]{6}$/u.test(text)) return text;
  if (/^#[a-f0-9]{3}$/u.test(text)) return '#' + [...text.slice(1)].map(ch => ch + ch).join('');
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/u.exec(text);
  if (rgb && rgb.slice(1).every(channel => Number(channel) <= 255)) {
    return '#' + rgb.slice(1).map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
  }
  throw new Error('DOCX_COLOR_RGB_INVALID');
}

function buildDocxColorPropertiesXml(inline = {}, { explicitOff = false } = {}) {
  const color = inline.color == null ? null : normalizeOpaqueRgb(inline.color);
  const highlight = inline.highlight == null ? null : normalizeOpaqueRgb(inline.highlight);
  const parts = [];
  if (color) parts.push(`<w:color w:val="${color.slice(1).toUpperCase()}"/>`);
  else if (explicitOff) parts.push('<w:color w:val="auto"/>');
  if (highlight) {
    const name = WORD_HIGHLIGHT_NAME_BY_COLOR[highlight];
    if (name) {
      parts.push(`<w:highlight w:val="${name}"/>`);
      if (explicitOff) parts.push('<w:shd w:val="nil"/>');
    } else {
      if (explicitOff) parts.push('<w:highlight w:val="none"/>');
      parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${highlight.slice(1).toUpperCase()}"/>`);
    }
  } else if (explicitOff) parts.push('<w:highlight w:val="none"/><w:shd w:val="nil"/>');
  return parts.join('');
}

module.exports = { WORD_HIGHLIGHT_COLOR_BY_NAME, WORD_HIGHLIGHT_NAME_BY_COLOR, normalizeOpaqueRgb, buildDocxColorPropertiesXml };
