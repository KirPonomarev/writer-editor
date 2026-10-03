import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import sections from '../../core/word-sections-v1.cjs';
const inlineOnly = tr => tr.steps.every((step, index) => {
  if (!step.slice || !Number.isInteger(step.from) || !Number.isInteger(step.to)) return false;
  const from = tr.docs[index].resolve(step.from), to = tr.docs[index].resolve(step.to);
  return from.sameParent(to) && from.parent.isTextblock && step.slice.openStart === 0 && step.slice.openEnd === 0
    && Array.from({length:step.slice.content.childCount},(_,i)=>step.slice.content.child(i)).every(node=>node.isInline);
});
function projectedSteps(before, transactions) {
  for (const tr of transactions) for (let i = 0; i < tr.steps.length; i++) {
    const next = (tr.docs[i + 1] || tr.doc).toJSON();
    before = sections.bind(next, sections.project(before, next));
  }
  return sections.read(before);
}
export const DocumentSections = Extension.create({
  name: 'documentSections',
  addGlobalAttributes() {
    return [{ types: ['doc'], attributes: { wordSections: { default: null, rendered: false, parseHTML: () => null } } }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      filterTransaction(tr, state) {
        if (!tr.docChanged || tr.getMeta('wordPendingRevisionsExternal') === true || state.doc.attrs.wordSections == null || inlineOnly(tr)) return true;
        try {
          projectedSteps(state.doc.toJSON(), [tr]);
          return true;
        } catch { return false; }
      },
      appendTransaction(transactions, old, state) {
        if (!transactions.some(tr=>tr.docChanged) || transactions.some(tr=>tr.getMeta('wordPendingRevisionsExternal')===true)
          || old.doc.attrs.wordSections == null || transactions.every(inlineOnly)) return null;
        const projected = projectedSteps(old.doc.toJSON(), transactions);
        if (JSON.stringify(state.doc.attrs.wordSections) === JSON.stringify(projected)) return null;
        return state.tr.setDocAttribute('wordSections', projected);
      },
    })];
  },
});
