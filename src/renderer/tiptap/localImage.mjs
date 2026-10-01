import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

// Main has already committed this exact image. Admit only a single insertion,
// preserving every other node/attribute and the existing Undo history.
export function applyLocalImagePublication(editor, doc, position) {
  if (!editor || !Number.isSafeInteger(position) || position < 1
    || position > editor.state.doc.content.size) return false;
  const next = editor.schema.nodeFromJSON(doc), image = next.nodeAt(position);
  if (!image || image.type.name !== 'image') return false;
  const tr = editor.state.tr.insert(position, image);
  if (!tr.doc.eq(next)) return false;
  tr.setSelection(TextSelection.near(tr.doc.resolve(position + image.nodeSize)));
  tr.setMeta('preventUpdate', true);
  editor.view.dispatch(closeHistory(tr));
  editor.view.dispatch(closeHistory(editor.state.tr).setMeta('addToHistory', false));
  return true;
}
