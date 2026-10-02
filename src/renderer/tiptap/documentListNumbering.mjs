import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import numbering from '../../core/word-list-numbering-v1.cjs';

// The Core counter owns semantics. This adapter only applies its projection to
// the current authoring transaction; persistence still uses canonical Save.
export const DocumentListNumbering = Extension.create({
  name: 'documentListNumbering',
  addGlobalAttributes() {
    return [{ types: ['orderedList'], attributes: {
      wordListId: { default: null, rendered: false, parseHTML: () => null },
      wordListStart: { default: null, rendered: false, parseHTML: () => null },
    } }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({ appendTransaction(transactions, _old, state) {
      if (!transactions.some(tr => tr.docChanged)) return null;
      // Ordinary typing inside one text block cannot change list topology.
      const textOnly = transactions.every(tr => tr.steps.every((step, index) => {
        if (!step.slice || !Number.isInteger(step.from) || !Number.isInteger(step.to)) return false;
        const from = tr.docs[index].resolve(step.from), to = tr.docs[index].resolve(step.to);
        return from.sameParent(to) && from.parent.isTextblock
          && step.slice.openStart === 0 && step.slice.openEnd === 0
          && Array.from({ length: step.slice.content.childCount }, (_, i) => step.slice.content.child(i))
            .every(node => node.isInline);
      }));
      if (textOnly) return null;
      const json = state.doc.toJSON(), starts = [...numbering.resolve(json).values()];
      if (!starts.length) return null;
      let index = 0; const tr = state.tr;
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'orderedList' || node.attrs.wordListId == null) return;
        const start = starts[index++];
        if (node.attrs.start !== start) tr.setNodeMarkup(pos, undefined, { ...node.attrs, start });
      });
      return tr.docChanged ? tr : null;
    } })];
  },
});
