import { Extension } from '@tiptap/core';
import { normalizeParagraphAlignment } from '../../io/paragraphAlignment.mjs';
import wordLanguage from '../../core/word-language-v1.cjs';
import wordSpacing from '../../core/word-paragraph-spacing-v1.cjs';

function selectedTextBlocks(state) {
  if (!state?.doc || !state.selection) return [];
  const { from, to, empty, $from } = state.selection;
  if (empty) return $from.parent.isTextblock ? [{ node: $from.parent, pos: $from.before() }] : [];
  const blocks = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && pos + 1 < to) blocks.push({ node, pos });
  });
  return blocks;
}

const supportsAlignment = node => ['paragraph', 'heading'].includes(node.type.name);

export function readParagraphAlignment(editor) {
  const blocks = selectedTextBlocks(editor?.state);
  if (!blocks.length || blocks.some(({ node }) => !supportsAlignment(node))) return '';
  const values = new Set(blocks.map(({ node }) => normalizeParagraphAlignment(node.attrs.textAlign) || 'left'));
  return values.size === 1 ? [...values][0] : '';
}

export const DocumentParagraphAlignment = Extension.create({
  name: 'documentParagraphAlignment',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        wordParagraphSpacing: {
          default: null,
          parseHTML: element => {
            const raw = element.getAttribute('data-word-paragraph-spacing');
            if (raw == null) return null;
            try { return wordSpacing.normalizeWordParagraphSpacing(JSON.parse(raw)); } catch { return null; }
          },
          renderHTML: attributes => {
            if (attributes.wordParagraphSpacing == null) return {};
            const spacing = wordSpacing.normalizeWordParagraphSpacing(attributes.wordParagraphSpacing);
            const css = [];
            if (spacing.before !== undefined) css.push(`margin-top: ${spacing.before / 20}pt`);
            if (spacing.after !== undefined) css.push(`margin-bottom: ${spacing.after / 20}pt`);
            if (spacing.line !== undefined) {
              if (!spacing.lineRule || spacing.lineRule === 'auto') css.push(`line-height: ${spacing.line / 240}`);
              else if (spacing.lineRule === 'exact') css.push(`line-height: ${spacing.line / 20}pt`);
              else css.push(`line-height: max(1em, ${spacing.line / 20}pt)`);
            }
            return { 'data-word-paragraph-spacing': JSON.stringify(spacing), ...(css.length ? { style: css.join('; ') } : {}) };
          },
        },
        wordParagraphMarkLanguage: {
          default: null,
          parseHTML: element => {
            const raw = element.getAttribute('data-word-paragraph-mark-language');
            if (raw == null) return null;
            try { return wordLanguage.normalizeWordLanguage(JSON.parse(raw)); } catch { return null; }
          },
          renderHTML: attributes => attributes.wordParagraphMarkLanguage == null ? {} : {
            'data-word-paragraph-mark-language': JSON.stringify(wordLanguage.normalizeWordLanguage(attributes.wordParagraphMarkLanguage)),
          },
        },
        textAlign: {
          default: null,
          parseHTML: element => {
            try { return normalizeParagraphAlignment(element.style.textAlign || null); } catch { return null; }
          },
          renderHTML: attributes => attributes.textAlign == null ? {} : {
            style: `text-align: ${normalizeParagraphAlignment(attributes.textAlign)}`,
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setParagraphAlignment: value => ({ tr, dispatch }) => {
        let textAlign;
        try { textAlign = normalizeParagraphAlignment(value); } catch { return false; }
        if (!textAlign) return false;
        const changed = selectedTextBlocks(tr).filter(({ node }) => supportsAlignment(node) && node.attrs.textAlign !== textAlign);
        if (!changed.length) return false;
        if (dispatch) for (const { node, pos } of changed) tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign });
        return true;
      },
    };
  },
});
