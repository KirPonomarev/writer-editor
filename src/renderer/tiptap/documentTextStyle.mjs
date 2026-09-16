import { TextStyle } from '@tiptap/extension-text-style';
import { normalizeFontFamily, normalizeFontSize } from '../../io/inlineTypography.mjs';

function readStyle(element, property, normalize) {
  const value = element.style[property];
  if (!value) return null;
  try { return normalize(value); } catch { return null; }
}

// Document marks retain their own typography. Shell font preferences continue
// to apply to unmarked text through the existing editor root styles.
export const DocumentTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontFamily: {
        default: null,
        parseHTML: element => readStyle(element, 'fontFamily', normalizeFontFamily),
        renderHTML: attributes => attributes.fontFamily == null ? {} : {
          style: `font-family: ${JSON.stringify(normalizeFontFamily(attributes.fontFamily))}`,
        },
      },
      fontSize: {
        default: null,
        parseHTML: element => readStyle(element, 'fontSize', normalizeFontSize),
        renderHTML: attributes => attributes.fontSize == null ? {} : {
          style: `font-size: ${normalizeFontSize(attributes.fontSize)}`,
        },
      },
    };
  },
});
