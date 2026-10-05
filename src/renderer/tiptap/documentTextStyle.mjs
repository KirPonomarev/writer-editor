import { TextStyle } from '@tiptap/extension-text-style';
import { normalizeFontFamily, normalizeFontSize } from '../../io/inlineTypography.mjs';
import wordLanguage from '../../core/word-language-v1.cjs';

function readStyle(element, property, normalize) {
  const value = element.style[property];
  if (!value) return null;
  try { return normalize(value); } catch { return null; }
}

// Document marks retain their own typography. Shell font preferences continue
// to apply to unmarked text through the existing editor root styles.
export const DocumentTextStyle = TextStyle.extend({
  parseHTML() {
    return [{
      // Language-only marks have no CSS style, so the upstream span[style]
      // rule cannot read our own serialized clipboard representation.
      tag: 'span[data-word-language]',
      consuming: false,
      getAttrs: element => {
        try {
          wordLanguage.normalizeWordLanguage(JSON.parse(element.getAttribute('data-word-language')));
          return {};
        } catch { return false; }
      },
    }, ...(this.parent?.() || [])];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      wordLanguage: {
        default: null,
        parseHTML: element => {
          const raw = element.getAttribute('data-word-language');
          if (raw == null) return null;
          try { return wordLanguage.normalizeWordLanguage(JSON.parse(raw)); } catch { return null; }
        },
        renderHTML: attributes => attributes.wordLanguage == null ? {} : {
          'data-word-language': JSON.stringify(wordLanguage.normalizeWordLanguage(attributes.wordLanguage)),
          ...(attributes.wordLanguage.val ? { lang: attributes.wordLanguage.val } : {}),
        },
      },
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
