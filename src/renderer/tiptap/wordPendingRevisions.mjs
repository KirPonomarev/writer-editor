import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import model from '../../core/word-pending-text-revisions-v1.cjs';

// Schema preservation and read-only review are separate from mutation authority.
// Only a checked main-published setContent replaces a review document.
export const WordPendingRevisions = Extension.create({
  name: 'wordPendingRevisions',
  addGlobalAttributes() {
    return [{ types: ['doc'], attributes: { wordPendingRevisions: { default: null, rendered: false, parseHTML: () => null } } }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('wordPendingRevisions'),
      props: { editable: state => !state.doc.attrs.wordPendingRevisions },
      filterTransaction(transaction, state) {
        if (!transaction.docChanged) return true;
        if (transaction.getMeta('wordPendingRevisionsExternal') === true) {
          try { model.readLedger(transaction.doc.toJSON()); return true; } catch { return false; }
        }
        if (state.doc.attrs.wordPendingRevisions || transaction.doc.attrs.wordPendingRevisions) return false;
        return true;
      },
    })];
  },
});
export function setCheckedDocument(editor, doc) {
  model.readLedger(doc);
  const target = editor.schema.nodeFromJSON(doc);
  target.check();
  return editor.chain().command(({ tr }) => { tr.setMeta('wordPendingRevisionsExternal', true); return true; })
    .setContent(doc, { emitUpdate: false, errorOnInvalidContent: true }).command(({ tr }) => {
      // setContent replaces children but retains the old root attributes.
      // The pending ledger and its complete projection must reach filters in
      // one transaction, including document settings and protected registries.
      for (const [key, value] of Object.entries(target.attrs)) tr.setDocAttribute(key, value);
      return true;
    }).run();
}
