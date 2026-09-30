import { Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import model from '../../core/word-user-bookmarks-v1.cjs';

// Inert schema preservation. Mapping and identity decisions belong to Core/main.
export const UserBookmarks = Extension.create({
  name: 'userBookmarks',
  addGlobalAttributes() {
    return [{ types: ['doc'], attributes: { wordUserBookmarks: {
      default: null, rendered: false, parseHTML: () => null,
    } } }];
  },
});
export const UserBookmarkLink = Link.extend({
  addAttributes() {
    return { ...this.parent?.(), wordBookmarkId: { default: null, rendered: false, parseHTML: () => null },
      wordBookmarkName: { default: null, rendered: false, parseHTML: () => null } };
  },
});

function protectedShape(node) {
  const out = { ...node };
  if (out.attrs) {
    out.attrs = { ...out.attrs }; delete out.attrs.wordUserBookmarks;
    for (const key of Object.keys(out.attrs)) if (out.attrs[key] === null) delete out.attrs[key];
    if (!Object.keys(out.attrs).length) delete out.attrs;
  }
  if (out.marks) {
    out.marks = out.marks.filter(mark => mark.type !== 'link');
    if (!out.marks.length) delete out.marks;
  }
  if (out.content) {
    out.content = out.content.map(protectedShape).reduce((nodes, child) => {
      const last = nodes.at(-1);
      if (last?.type === 'text' && child.type === 'text'
        && JSON.stringify(last.marks || []) === JSON.stringify(child.marks || [])) last.text += child.text;
      else nodes.push(child);
      return nodes;
    }, []);
  }
  return out;
}
function semanticBytes(value) {
  return JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function applyUserBookmarkPublication(editor, doc, affectedBookmarkId = null) {
  model.readRegistry(doc);
  const current = editor.state.doc.toJSON();
  if (semanticBytes(protectedShape(current)) !== semanticBytes(protectedShape(doc))) return false;
  const next = editor.schema.nodeFromJSON(doc);
  const links = document => {
    const result = [];
    document.descendants((node, pos) => {
      if (node.isText) for (const mark of node.marks) if (mark.type.name === 'link') {
        const attrs = Object.fromEntries(Object.entries(mark.attrs).filter(([, value]) => value !== null));
        result.push({ from: pos, to: pos + node.nodeSize, attrs });
      }
    });
    return result;
  };
  const previousLinks = links(editor.state.doc), nextLinks = links(next);
  const affected = new Set(Array.isArray(affectedBookmarkId) ? affectedBookmarkId : affectedBookmarkId ? [affectedBookmarkId] : []);
  const boundaries = [...new Set([...previousLinks, ...nextLinks].flatMap(link => [link.from, link.to]))].sort((a, b) => a - b);
  const changed = [];
  let previousIndex = 0, nextIndex = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const from = boundaries[i], to = boundaries[i + 1];
    while (previousIndex < previousLinks.length && previousLinks[previousIndex].to <= from) previousIndex++;
    while (nextIndex < nextLinks.length && nextLinks[nextIndex].to <= from) nextIndex++;
    const before = previousLinks[previousIndex]?.from <= from ? previousLinks[previousIndex] : null;
    const after = nextLinks[nextIndex]?.from <= from ? nextLinks[nextIndex] : null;
    if (!before && !after) continue;
    if (!before || !after) return false;
    if (semanticBytes(before.attrs) === semanticBytes(after.attrs)) continue;
    if (!affected.has(before.attrs.wordBookmarkId) || after.attrs.wordBookmarkId !== before.attrs.wordBookmarkId) return false;
    const protectedAttrs = attrs => Object.fromEntries(Object.entries(attrs).filter(([key]) => !['href', 'wordBookmarkName'].includes(key)));
    if (semanticBytes(protectedAttrs(before.attrs)) !== semanticBytes(protectedAttrs(after.attrs))) return false;
    changed.push({ from, to, attrs: after.attrs });
  }
  const tr = editor.state.tr.setDocAttribute(model.KEY, doc.attrs?.[model.KEY] || null);
  for (const link of changed) tr.removeMark(link.from, link.to, editor.schema.marks.link)
    .addMark(link.from, link.to, editor.schema.marks.link.create(link.attrs));
  tr.setMeta('preventUpdate', true).setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return true;
}
