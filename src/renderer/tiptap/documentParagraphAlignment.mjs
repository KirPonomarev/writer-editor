import { Extension } from '@tiptap/core';
import { normalizeParagraphAlignment } from '../../io/paragraphAlignment.mjs';

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
