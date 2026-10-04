import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { sha256Hex } from '../../core/browser-safe-hash.mjs';

const ledgerKey = new PluginKey('commentEditIntents');
const checkpointKey = new PluginKey('commentEditCheckpoint');
const leafCounts = new WeakMap();
const paragraphTypes = new Set(['paragraph', 'heading', 'codeBlock']);
const countLeaves = node => {
  if (leafCounts.has(node)) return leafCounts.get(node);
  let count = paragraphTypes.has(node.type.name) ? 1 : 0;
  if (!count) node.forEach(child => { count += countLeaves(child); });
  leafCounts.set(node, count);
  return count;
};
function paragraphAt(doc, position) {
  const at = doc.resolve(position);
  if (!paragraphTypes.has(at.parent.type.name)) throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
  let paragraphIndex = 0;
  for (let depth = 0; depth < at.depth; depth++) {
    const parent = at.node(depth);
    for (let index = 0; index < at.index(depth); index++) paragraphIndex += countLeaves(parent.child(index));
  }
  return { paragraphIndex, node: at.parent, offset: at.parentOffset };
}
function inlineText(node) {
  let text = '';
  node.forEach(child => {
    if (child.isText) text += child.text;
    else if (child.type.name === 'hardBreak') text += '\n';
    else throw new Error('COMMENT_EDIT_INLINE_UNSUPPORTED');
  });
  return text;
}
function paragraphs(doc) {
  const result = [];
  doc.descendants(node => {
    if (!paragraphTypes.has(node.type.name)) return true;
    result.push(inlineText(node)); return false;
  });
  if (result.length > 10000) throw new Error('COMMENT_EDIT_BUDGET');
  return result;
}
function eventBookmark(branch) {
  for (let index = branch?.items?.length - 1; index >= 0; index--) {
    const bookmark = branch.items.get(index).selection;
    if (bookmark) return bookmark;
  }
  return null;
}
function historyState(state) {
  const plugin = state.plugins.find(item => /^history\$/u.test(item.key));
  return plugin?.getState(state);
}
function initial(doc) {
  countLeaves(doc);
  return { baseline: doc, edits: [], groups: new Map(), incarnation: globalThis.crypto.randomUUID(), nextGroup: 1, nextEdit: 1, invalid: false };
}
function capture(tr, previous, oldState, newState) {
  if (tr.getMeta('wordPendingRevisionsExternal') === true) return initial(tr.doc);
  if (tr.getMeta(checkpointKey) === true) return { ...previous, baseline: tr.doc, edits: [], invalid: false };
  if (!tr.docChanged || previous.invalid) return previous;
  try {
    const edits = [];
    for (let index = 0; index < tr.steps.length; index++) {
      const step = tr.steps[index], kind = step.toJSON().stepType;
      if (['addMark', 'removeMark', 'attr', 'docAttr'].includes(kind)) continue;
      if (kind !== 'replace' || step.slice.openStart || step.slice.openEnd)
        throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
      const before = tr.docs[index], from = paragraphAt(before, step.from), to = paragraphAt(before, step.to);
      if (from.node !== to.node) throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
      const text = inlineText(from.node), insertText = inlineText(step.slice.content);
      const removedText = text.slice(from.offset, to.offset);
      if (removedText === insertText) continue;
      edits.push({ paragraphIndex: from.paragraphIndex, fromUtf16: from.offset, toUtf16: to.offset, removedText, insertText });
    }
    if (!edits.length) return previous;
    const before = historyState(oldState), after = historyState(newState);
    if (!before || !after) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
    const groups = new Map(previous.groups);
    let nextGroup = previous.nextGroup, direction = 'forward', historyId;
    if (isHistoryTransaction(tr)) {
      const redo = after.done.eventCount > before.done.eventCount;
      direction = redo ? 'redo' : 'undo';
      historyId = groups.get(eventBookmark(redo ? before.undone : before.done));
      if (!historyId) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
      const destination = eventBookmark(redo ? after.done : after.undone);
      if (destination) groups.set(destination, historyId);
    } else {
      if (tr.getMeta('addToHistory') === false) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
      const bookmark = eventBookmark(after.done);
      if (!bookmark) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
      historyId = groups.get(bookmark);
      if (!historyId) { historyId = `${previous.incarnation}-h${nextGroup++}`; groups.set(bookmark, historyId); }
    }
    if (groups.size > 256) {
      const retained = new Set();
      for (const branch of [after.done, after.undone]) {
        if (branch.items.length > 8192) throw new Error('COMMENT_EDIT_HISTORY_BUDGET');
        branch.items.forEach(item => { if (item.selection) retained.add(item.selection); });
      }
      for (const bookmark of groups.keys()) if (!retained.has(bookmark)) groups.delete(bookmark);
      if (groups.size > 512) throw new Error('COMMENT_EDIT_HISTORY_BUDGET');
    }
    let nextEdit = previous.nextEdit;
    const combined = [...previous.edits, ...edits.map(edit => ({ id: `${previous.incarnation}-e${nextEdit++}`, historyId, direction, ...edit }))];
    if (combined.length > 256 || new TextEncoder().encode(JSON.stringify(combined)).length > 64000)
      throw new Error('COMMENT_EDIT_BUDGET');
    return { ...previous, edits: combined, groups, nextGroup, nextEdit };
  } catch { return { ...previous, invalid: true }; }
}

// Only actual transactions create edit intent. Core owns validation and anchors.
// Run after the installed history plugin so its real grouping is observable.
export const DocumentCommentEditIntents = Extension.create({
  name: 'documentCommentEditIntents', priority: 50,
  addProseMirrorPlugins() { return [new Plugin({
    key: ledgerKey,
    state: { init: (_config, state) => initial(state.doc), apply: capture },
  })]; },
});
export function getCommentEditIntentsJson(editor) {
  if (!editor || editor.isDestroyed) return null;
  const ledger = ledgerKey.getState(editor.state);
  if (!ledger || ledger.invalid) return null;
  try {
    const wire = JSON.stringify({ schemaVersion: 1,
      baselineTextSha256: sha256Hex(JSON.stringify(paragraphs(ledger.baseline))), edits: ledger.edits });
    return new TextEncoder().encode(wire).length <= 65536 ? wire : null;
  } catch { return null; }
}
export function checkpointCommentEditIntents(editor) {
  if (!editor || editor.isDestroyed) return false;
  editor.view.dispatch(editor.state.tr.setMeta(checkpointKey, true).setMeta('addToHistory', false));
  return true;
}
export function commentSelectionIntent(editor) {
  if (!editor || editor.isDestroyed) throw new Error('COMMENT_EDIT_EDITOR_UNAVAILABLE');
  const { from, to } = editor.state.selection;
  const start = paragraphAt(editor.state.doc, from), end = paragraphAt(editor.state.doc, to);
  if (start.node !== end.node) throw new Error('Комментарий должен находиться внутри одного абзаца.');
  const text = inlineText(start.node), edges = new Set([text.length,
    ...Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), segment => segment.index)]);
  if (!edges.has(start.offset) || !edges.has(end.offset)) throw new Error('Выделите целые символы внутри одного абзаца.');
  return { paragraphIndex: start.paragraphIndex, startUtf16: start.offset, selectedText: text.slice(start.offset, end.offset),
    ...(from === to ? { kind: 'point', affinity: 'right' } : {}) };
}
